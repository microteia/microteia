import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentSession } from './authenticateAgent';
import { createSchemaContext } from '../../domain/schema/screenEntity';
import { UNRESTRICTED_PERMISSION } from '../../domain/schema/access/memberPermissions';
import type { MessageCatalog } from '../../domain/schema/i18n/messages';
import { runAgentOperation } from './runAgentOperation';

/**
 * Issue #51: o `create_record` do agente gravava só o que recebia, e o campo com `defaultValue` ficava
 * ausente — o registro do formulário nascia com `active: true`, o do agente, sem nada. O executor já
 * sabia semear (`seedDefaults`); faltava o agente pedir.
 */
const ctx = createSchemaContext([{ id: 'atividades', titleSingular: 'Atividade', titleFieldKey: 'nome', fields: [] }], [], []);

const upsert = vi.fn();
vi.mock('../workflow/mutation/runWorkflowMutation', () => ({
  runWorkflowUpsert: (...args: unknown[]) => upsert(...args),
  runWorkflowRemove: vi.fn(),
}));
vi.mock('./agentContext', () => ({ agentRun: async () => ({ context: {} }), agentReader: vi.fn() }));
vi.mock('../di/container', () => ({
  getDI: () => ({ getScreenDefinitionCache: () => ({ getSchemaContext: async () => ctx }) }),
}));
vi.mock('../firebase/initFirebase', () => ({ getDb: () => ({}) }));

const session: AgentSession = {
  tenantId: 'escritorio1',
  userId: 'membro1',
  grantId: 'acesso1',
  grantName: 'Claude',
  permissions: [UNRESTRICTED_PERMISSION],
  ceiling: [UNRESTRICTED_PERMISSION],
  expiresAt: null,
  lastUsedAt: null,
};

const catalog: MessageCatalog = { locale: 'en', messages: {} };

const optionsOf = async (tool: string, input: Record<string, unknown>) => {
  upsert.mockResolvedValue({ ok: true, value: { id: 'r1', created: tool === 'create_record', record: {} } });
  await runAgentOperation(tool, input, session, catalog);
  return upsert.mock.calls[0][3];
};

describe('o agente cria como o formulário: o campo ausente nasce com o padrão (#51)', () => {
  beforeEach(() => upsert.mockReset());

  it('create_record pede a semente do `defaultValue`', async () => {
    expect(await optionsOf('create_record', { collection: 'atividades', data: { nome: 'A' } }))
      .toEqual({ seedDefaults: true });
  });

  it('update_record pede o mesmo, e o executor só semeia na CRIAÇÃO — alterar nunca recebe padrão', async () => {
    expect(await optionsOf('update_record', { collection: 'atividades', id: 'r1', data: { nome: 'B' } }))
      .toEqual({ seedDefaults: true });
  });
});
