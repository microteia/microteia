import { describe, expect, it } from 'vitest';
import { authorizeOperation, permissionCharge } from './agentAuthorization';
import type { AgentSession } from './authenticateAgent';
import { agentToolByName } from '../../domain/schema/agent/agentOps';
import { createSchemaContext } from '../../domain/schema/screenEntity';
import { UNRESTRICTED_PERMISSION } from '../../domain/schema/access/memberPermissions';
import { PERMISSION_AUTOMATION_RUN } from '../../domain/schema/access/kernelPermissions';

const ctx = createSchemaContext(
  [{ id: 'clientes', titleSingular: 'Cliente', titleFieldKey: 'nome', fields: [] }],
  [{ collection: 'especialidades', label: 'Especialidades' }],
  [{ collection: 'clienteTags', label: 'Etiquetas' }],
);

const session = (permissions: string[]): AgentSession => ({
  tenantId: 'escritorio1',
  userId: 'membro1',
  grantId: 'acesso1',
  grantName: 'Claude',
  permissions,
  ceiling: permissions,
  expiresAt: null,
  lastUsedAt: null,
});

const tool = (name: string) => {
  const found = agentToolByName(name);
  if (found === null) throw new Error(`ferramenta ${name} não existe`);
  return found;
};

describe('qual permissão cada operação cobra', () => {
  it('deriva `<coleção>.<ação>` do argumento, e não do nome da ferramenta', () => {
    expect(permissionCharge(ctx, tool('search_records'), { collection: 'clientes' }))
      .toEqual({ kind: 'charge', permission: 'clientes.read' });
    expect(permissionCharge(ctx, tool('create_record'), { collection: 'clientes' }))
      .toEqual({ kind: 'charge', permission: 'clientes.create' });
    expect(permissionCharge(ctx, tool('update_record'), { collection: 'clientes' }))
      .toEqual({ kind: 'charge', permission: 'clientes.update' });
    expect(permissionCharge(ctx, tool('delete_record'), { collection: 'clientes' }))
      .toEqual({ kind: 'charge', permission: 'clientes.delete' });
  });

  it('a coleção é aparada antes de virar permissão', () => {
    expect(permissionCharge(ctx, tool('get_record'), { collection: '  clientes  ' }))
      .toEqual({ kind: 'charge', permission: 'clientes.read' });
  });

  it('sem coleção não há o que cobrar, e a chamada é recusada em vez de liberada', () => {
    expect(permissionCharge(ctx, tool('search_records'), {})).toEqual({ kind: 'missing-collection' });
    expect(permissionCharge(ctx, tool('search_records'), { collection: '   ' }))
      .toEqual({ kind: 'missing-collection' });
    expect(permissionCharge(ctx, tool('search_records'), { collection: 42 }))
      .toEqual({ kind: 'missing-collection' });
  });

  it('a permissão fixa vem da declaração da ferramenta', () => {
    expect(permissionCharge(ctx, tool('run_workflow'), {}))
      .toEqual({ kind: 'charge', permission: PERMISSION_AUTOMATION_RUN });
    expect(permissionCharge(ctx, tool('run_action'), {}))
      .toEqual({ kind: 'charge', permission: PERMISSION_AUTOMATION_RUN });
  });

  // O relatório cobra por coleção alcançada, INCLUSIVE as alcançadas por referência, e nenhuma regra
  // escrita aqui saberia enumerá-las: quem executa cobra.
  it('o relatório delega a cobrança a quem o executa', () => {
    expect(permissionCharge(ctx, tool('run_report'), { report: 'faturamento' }))
      .toEqual({ kind: 'delegated' });
  });
});

/**
 * A leitura de VOCABULÁRIO não é cobrada, e isso não é conveniência: `firestore.rules` libera a
 * leitura de uma lista de opções ou de um conjunto de etiquetas a qualquer membro
 * (`isDeclaredVocabulary`), porque são vocabulário e não dado. Divergir aqui faria a mesma pergunta
 * ter duas respostas — e obrigaria quem emite um acesso a listar cada uma das dezenas de listas do
 * escritório só para um campo de seleção poder ser preenchido.
 */
describe('vocabulário — a leitura que a regra do Firestore não cobra', () => {
  it('a lista de opções é lida sem permissão', () => {
    expect(permissionCharge(ctx, tool('search_records'), { collection: 'especialidades' }))
      .toEqual({ kind: 'vocabulary' });
  });

  it('o conjunto de etiquetas também', () => {
    expect(permissionCharge(ctx, tool('get_record'), { collection: 'clienteTags' }))
      .toEqual({ kind: 'vocabulary' });
  });

  // A ESCRITA continua cobrada, exatamente como na regra: a isenção é só de leitura.
  it('mas gravar numa lista é cobrado como em qualquer coleção', () => {
    expect(permissionCharge(ctx, tool('create_record'), { collection: 'especialidades' }))
      .toEqual({ kind: 'charge', permission: 'especialidades.create' });
    expect(permissionCharge(ctx, tool('delete_record'), { collection: 'clienteTags' }))
      .toEqual({ kind: 'charge', permission: 'clienteTags.delete' });
  });
});

describe('a decisão', () => {
  it('autoriza quando o acesso tem a permissão cobrada', () => {
    expect(authorizeOperation(session(['clientes.read']), { kind: 'charge', permission: 'clientes.read' }))
      .toEqual({ ok: true });
  });

  it('recusa NOMEANDO a permissão que falta — é o que o modelo precisa para pedir a certa', () => {
    expect(authorizeOperation(session(['clientes.read']), { kind: 'charge', permission: 'clientes.delete' }))
      .toEqual({
        ok: false,
        error: '@core.access/permission.denied',
        params: { permission: 'clientes.delete' },
      });
  });

  it('o curinga autoriza — quem o tem é o dono, e o teto dele já foi aplicado na interseção', () => {
    expect(authorizeOperation(session([UNRESTRICTED_PERMISSION]), { kind: 'charge', permission: 'x.delete' }))
      .toEqual({ ok: true });
  });

  it('vocabulário e delegado passam sem cobrança', () => {
    expect(authorizeOperation(session([]), { kind: 'vocabulary' })).toEqual({ ok: true });
    expect(authorizeOperation(session([]), { kind: 'delegated' })).toEqual({ ok: true });
  });

  it('coleção ausente é recusa, nunca liberação', () => {
    expect(authorizeOperation(session([UNRESTRICTED_PERMISSION]), { kind: 'missing-collection' }).ok)
      .toBe(false);
  });
});
