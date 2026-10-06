import { describe, expect, it, vi } from 'vitest';
import type { AgentAuthDeps } from './authenticateAgent';
import { authenticateAgent } from './authenticateAgent';
import type { AgentGrant } from '../../domain/schema/agent/agentGrant';
import {
  buildAgentToken,
  generateAgentSecret,
  hashAgentSecret,
} from '../../domain/schema/agent/agentGrant';
import { AGENT_MCP_FUNCTION } from '../../domain/schema/agent/agentBackend';
import { UNRESTRICTED_PERMISSION } from '../../domain/schema/access/memberPermissions';

const AGORA = new Date('2026-09-10T12:00:00Z');
const SEGREDO = generateAgentSecret();
const TOKEN = buildAgentToken({ tenantId: 'escritorio1', grantId: 'acesso1', secret: SEGREDO })!;

const acesso = async (sobrepondo: Partial<AgentGrant> = {}): Promise<AgentGrant> => ({
  id: 'acesso1',
  tenantId: 'escritorio1',
  userId: 'membro1',
  name: 'Claude no terminal',
  permissions: ['clientes.read', 'clientes.create'],
  secretHash: await hashAgentSecret(SEGREDO),
  expiresAt: null,
  revokedAt: null,
  lastUsedAt: null,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  createdBy: 'membro1',
  origin: 'manual',
  accessExpiresAt: null,
  refreshHash: null,
  clientId: null,
  ...sobrepondo,
});

const deps = (sobrepondo: Partial<AgentAuthDeps> = {}): AgentAuthDeps => ({
  readGrant: async () => acesso(),
  claimsFunction: async () => true,
  granted: async () => ['clientes.read', 'clientes.create', 'processos.read'],
  now: () => AGORA,
  ...sobrepondo,
});

describe('o token que vale', () => {
  it('vira uma sessão com a interseção, e não com o teto', async () => {
    const resultado = await authenticateAgent(TOKEN, deps());
    expect(resultado).toEqual({
      ok: true,
      session: {
        tenantId: 'escritorio1',
        userId: 'membro1',
        grantId: 'acesso1',
        grantName: 'Claude no terminal',
        permissions: ['clientes.create', 'clientes.read'],
        ceiling: ['clientes.read', 'clientes.create'],
        expiresAt: null,
        lastUsedAt: null,
      },
    });
  });

  it('o escritório vem do TOKEN, e é por ele que o acesso é procurado', async () => {
    const readGrant = vi.fn(async () => acesso());
    await authenticateAgent(TOKEN, deps({ readGrant }));
    expect(readGrant).toHaveBeenCalledWith('escritorio1', 'acesso1');
  });

  it('o teto vale contra o dono do escritório, que tem o curinga', async () => {
    const resultado = await authenticateAgent(TOKEN, deps({ granted: async () => [UNRESTRICTED_PERMISSION] }));
    expect(resultado.ok && resultado.session.permissions).toEqual(['clientes.create', 'clientes.read']);
  });
});

describe('as recusas — uma a uma, e nenhuma devolve sessão', () => {
  it('recusa token malformado sem ler nada', async () => {
    const readGrant = vi.fn(async () => acesso());
    const claimsFunction = vi.fn(async () => true);
    const resultado = await authenticateAgent('Bearer sei-la', deps({ readGrant, claimsFunction }));
    expect(resultado).toEqual({ ok: false, refusal: 'malformed' });
    expect(readGrant).not.toHaveBeenCalled();
    expect(claimsFunction).not.toHaveBeenCalled();
  });

  it('recusa token ausente', async () => {
    expect(await authenticateAgent(undefined, deps())).toEqual({ ok: false, refusal: 'malformed' });
  });

  // O interruptor: desativar a extensão faz o acesso parar de valer no instante seguinte, sem
  // depender de ninguém retirar a function do projeto.
  it('recusa quando nenhuma extensão instalada reivindica a function', async () => {
    const readGrant = vi.fn(async () => acesso());
    const resultado = await authenticateAgent(TOKEN, deps({ claimsFunction: async () => false, readGrant }));
    expect(resultado).toEqual({ ok: false, refusal: 'inactive' });
  });

  // A ordem importa: num escritório com a extensão desativada, nem a EXISTÊNCIA de um acesso é
  // observável. Ler o acesso antes do portão tornaria o desligamento parcial.
  it('não lê o acesso quando a extensão está desativada', async () => {
    const readGrant = vi.fn(async () => acesso());
    await authenticateAgent(TOKEN, deps({ claimsFunction: async () => false, readGrant }));
    expect(readGrant).not.toHaveBeenCalled();
  });

  it('pergunta o portão pelo NOME da própria function, nunca por um id de plugin', async () => {
    const claimsFunction = vi.fn(async () => true);
    await authenticateAgent(TOKEN, deps({ claimsFunction }));
    expect(claimsFunction).toHaveBeenCalledWith('escritorio1', AGENT_MCP_FUNCTION);
  });

  it('recusa acesso inexistente', async () => {
    expect(await authenticateAgent(TOKEN, deps({ readGrant: async () => null })))
      .toEqual({ ok: false, refusal: 'unknown' });
  });

  // As duas respondem IGUAL de propósito: distinguir diria a quem tenta se aquele id existe.
  it('recusa segredo errado com a MESMA resposta de acesso inexistente', async () => {
    const outro = buildAgentToken({
      tenantId: 'escritorio1',
      grantId: 'acesso1',
      secret: generateAgentSecret(),
    })!;
    expect(await authenticateAgent(outro, deps())).toEqual({ ok: false, refusal: 'unknown' });
  });

  it('recusa acesso revogado', async () => {
    const revogado = deps({ readGrant: async () => acesso({ revokedAt: new Date('2026-09-05T00:00:00Z') }) });
    expect(await authenticateAgent(TOKEN, revogado)).toEqual({ ok: false, refusal: 'revoked' });
  });

  it('recusa acesso expirado', async () => {
    const expirado = deps({ readGrant: async () => acesso({ expiresAt: new Date('2026-09-09T00:00:00Z') }) });
    expect(await authenticateAgent(TOKEN, expirado)).toEqual({ ok: false, refusal: 'expired' });
  });

  // Estreitar sem tocar no token: quem perdeu o perfil perde o agente.
  it('recusa quando o usuário não tem mais nenhuma das permissões do teto', async () => {
    expect(await authenticateAgent(TOKEN, deps({ granted: async () => ['processos.read'] })))
      .toEqual({ ok: false, refusal: 'no-access' });
  });

  it('recusa quem deixou de ser membro', async () => {
    expect(await authenticateAgent(TOKEN, deps({ granted: async () => [] })))
      .toEqual({ ok: false, refusal: 'no-access' });
  });

  it('recusa teto vazio, mesmo com o usuário podendo tudo', async () => {
    const semTeto = deps({
      readGrant: async () => acesso({ permissions: [] }),
      granted: async () => [UNRESTRICTED_PERMISSION],
    });
    expect(await authenticateAgent(TOKEN, semTeto)).toEqual({ ok: false, refusal: 'no-access' });
  });

  // Um acesso sem dono não é um acesso degradado: não há de quem cruzar as permissões. Ele responde
  // como inexistente, e a checagem é feita AQUI mesmo sendo redundante com o repositório — esta é a
  // fronteira, e uma fronteira que confia no filtro de quem a alimenta não é fronteira.
  it('recusa quando o acesso perdeu o dono, sem perguntar as permissões de ninguém', async () => {
    const granted = vi.fn(async () => [UNRESTRICTED_PERMISSION]);
    const orfao = deps({ readGrant: async () => acesso({ userId: '' }), granted });
    expect(await authenticateAgent(TOKEN, orfao)).toEqual({ ok: false, refusal: 'unknown' });
    expect(granted).not.toHaveBeenCalled();
  });
});
