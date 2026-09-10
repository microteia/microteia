import { describe, expect, it } from 'vitest';
import {
  AGENT_SECRET_LENGTH,
  AGENT_TOKEN_PREFIX,
  buildAgentToken,
  effectiveAgentPermissions,
  generateAgentSecret,
  grantRefusal,
  hashAgentSecret,
  parseAgentToken,
  secretHashMatches,
} from './agentGrant';
import { UNRESTRICTED_PERMISSION } from '../access/memberPermissions';

const SECRET = 'a'.repeat(AGENT_SECRET_LENGTH);

describe('formato do token', () => {
  it('monta e desmonta o mesmo token', () => {
    const parsed = { tenantId: 'escritorio1', grantId: 'acesso1', secret: SECRET };
    const token = buildAgentToken(parsed);
    expect(token).toBe(`${AGENT_TOKEN_PREFIX}escritorio1.acesso1.${SECRET}`);
    expect(parseAgentToken(token)).toEqual(parsed);
  });

  it('sorteia segredo do tamanho declarado, e no alfabeto do token', () => {
    const secret = generateAgentSecret();
    expect(secret).toHaveLength(AGENT_SECRET_LENGTH);
    expect(buildAgentToken({ tenantId: 't', grantId: 'g', secret })).not.toBeNull();
  });

  it('sorteia segredo diferente a cada chamada', () => {
    const sorteados = new Set(Array.from({ length: 50 }, () => generateAgentSecret()));
    expect(sorteados.size).toBe(50);
  });

  // Um parse que "quase" aceita é o que faz um token malformado seguir adiante e ser procurado no
  // banco. Todas as recusas devolvem null, e o chamador as trata como recusa — nunca como
  // "procure de outro jeito".
  it.each([
    ['sem o prefixo', `escritorio1.acesso1.${SECRET}`],
    ['sem segredo', `${AGENT_TOKEN_PREFIX}escritorio1.acesso1`],
    ['com segmento a mais', `${AGENT_TOKEN_PREFIX}a.b.c.${SECRET}`],
    ['segredo curto', `${AGENT_TOKEN_PREFIX}a.b.abc`],
    ['segredo com caractere fora do alfabeto', `${AGENT_TOKEN_PREFIX}a.b.${'/'.repeat(AGENT_SECRET_LENGTH)}`],
    ['escritório vazio', `${AGENT_TOKEN_PREFIX}.b.${SECRET}`],
    ['texto qualquer', 'Bearer abc'],
    ['vazio', ''],
  ])('recusa %s', (_caso, bruto) => {
    expect(parseAgentToken(bruto)).toBeNull();
  });

  it('recusa o que não é texto', () => {
    expect(parseAgentToken(undefined)).toBeNull();
    expect(parseAgentToken(null)).toBeNull();
    expect(parseAgentToken({ tenantId: 't' })).toBeNull();
  });

  // O ponto é o separador. Um id que o contenha tornaria o parse ambíguo, e dois tokens diferentes
  // poderiam casar com o mesmo registro.
  it('recusa montar com ponto dentro de um segmento', () => {
    expect(buildAgentToken({ tenantId: 'a.b', grantId: 'g', secret: SECRET })).toBeNull();
    expect(buildAgentToken({ tenantId: 't', grantId: 'a.b', secret: SECRET })).toBeNull();
  });
});

describe('hash do segredo', () => {
  it('é estável e específico do segredo', async () => {
    const primeiro = await hashAgentSecret(SECRET);
    expect(await hashAgentSecret(SECRET)).toBe(primeiro);
    expect(await hashAgentSecret(`${SECRET.slice(1)}b`)).not.toBe(primeiro);
    expect(primeiro).toMatch(/^[0-9a-f]{64}$/);
  });

  it('compara sem atalho de tamanho nem de conteúdo', async () => {
    const hash = await hashAgentSecret(SECRET);
    expect(secretHashMatches(hash, hash)).toBe(true);
    expect(secretHashMatches(hash, hash.slice(0, -1))).toBe(false);
    const ultimo = hash.slice(-1);
    const diferente = `${hash.slice(0, -1)}${ultimo === '0' ? '1' : '0'}`;
    expect(secretHashMatches(hash, diferente)).toBe(false);
  });
});

describe('validade do acesso', () => {
  const agora = new Date('2026-09-10T12:00:00Z');

  it('vale quando não foi revogado nem expirou', () => {
    expect(grantRefusal({ revokedAt: null, expiresAt: null }, agora)).toBeNull();
    expect(grantRefusal({ revokedAt: null, expiresAt: new Date('2026-09-11T12:00:00Z') }, agora)).toBeNull();
  });

  it('a revogação vence a validade — o motivo que interessa é o que exige outra ação', () => {
    const revogado = { revokedAt: new Date('2026-09-01T00:00:00Z'), expiresAt: new Date('2026-01-01T00:00:00Z') };
    expect(grantRefusal(revogado, agora)).toBe('revoked');
  });

  it('expira no instante declarado, não depois dele', () => {
    expect(grantRefusal({ revokedAt: null, expiresAt: agora }, agora)).toBe('expired');
  });
});

describe('permissão efetiva — a interseção', () => {
  it('é o que o usuário tem cruzado com o teto do acesso', () => {
    expect(effectiveAgentPermissions(['a.read', 'a.create', 'b.read'], ['a.read', 'b.read', 'c.read']))
      .toEqual(['a.read', 'b.read']);
  });

  // A propriedade que dispensa um segundo modelo de autorização: o teto pode pedir mais do que o
  // usuário tem, e não recebe nada por isso.
  it('nunca excede o do usuário, mesmo que o teto peça mais', () => {
    expect(effectiveAgentPermissions(['a.read'], ['a.read', 'a.delete'])).toEqual(['a.read']);
  });

  it('estreita quando o usuário perde o perfil, sem tocar no token', () => {
    const teto = ['a.read', 'a.update'];
    expect(effectiveAgentPermissions(['a.read', 'a.update'], teto)).toEqual(['a.read', 'a.update']);
    expect(effectiveAgentPermissions([], teto)).toEqual([]);
  });

  // O curinga do dono é a AUSÊNCIA de limite, não uma permissão. Sem este caso, o dono do escritório
  // receberia acesso irrestrito em todo token que emitisse — o oposto de declarar um teto.
  it('o curinga do dono interseca para exatamente o teto declarado', () => {
    expect(effectiveAgentPermissions([UNRESTRICTED_PERMISSION], ['a.read'])).toEqual(['a.read']);
    expect(effectiveAgentPermissions([UNRESTRICTED_PERMISSION], [])).toEqual([]);
  });

  // Um teto que se declara irrestrito é recusado na EMISSÃO. Aqui ele é descartado para que, se
  // algum dia um documento o carregue, ele não conceda tudo.
  it('descarta o curinga vindo do lado do teto', () => {
    expect(effectiveAgentPermissions([UNRESTRICTED_PERMISSION], [UNRESTRICTED_PERMISSION])).toEqual([]);
    expect(effectiveAgentPermissions(['a.read'], [UNRESTRICTED_PERMISSION, 'a.read'])).toEqual(['a.read']);
  });

  it('não repete permissão declarada duas vezes', () => {
    expect(effectiveAgentPermissions(['a.read'], ['a.read', 'a.read'])).toEqual(['a.read']);
  });
});
