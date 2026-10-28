import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsert = vi.fn();

vi.mock('../workflow/mutation/runWorkflowMutation', () => ({ runWorkflowUpsert: (...args: unknown[]) => upsert(...args) }));
vi.mock('../../data/services/FirestoreWorkflowMutationRepository', () => ({ FirestoreWorkflowMutationRepository: class {} }));
vi.mock('./identifyPortalActor', () => ({ identifyPortalActor: async () => ({ userId: 'g1', name: 'Convidado', photoURL: '', via: 'portal', permissions: [] }) }));
vi.mock('../settings/tenantTimeZone', () => ({ tenantTimeZone: async () => 'America/Sao_Paulo' }));
vi.mock('../settings/tenantBusinessCalendars', () => ({ tenantBusinessCalendars: async () => [] }));
vi.mock('../firebase/initFirebase', () => ({ getDb: () => ({}) }));
vi.mock('../di/container', () => ({ getDI: () => ({ getScreenDefinitionCache: () => ({}) }) }));

import { portalRecordWriter } from './portalRecordWriter';

describe('portalRecordWriter', () => {
  beforeEach(() => {
    upsert.mockReset();
    upsert.mockResolvedValue({ ok: true, value: { id: 'r1', created: true, record: {} } });
  });

  it('criar semeia o padrão do que o convidado não preenche', async () => {
    await portalRecordWriter({ tenantId: 't1', collection: 'pedidos', data: { assunto: 'Aceite' }, userId: 'g1' });
    expect(upsert.mock.calls[0][0]).toEqual({ table: 'pedidos', data: { assunto: 'Aceite' } });
    expect(upsert.mock.calls[0][3]).toEqual({ seedDefaults: true });
  });

  it('alterar não semeia nada e nunca cria', async () => {
    await portalRecordWriter({ tenantId: 't1', collection: 'pedidos', data: { assunto: 'Novo' }, userId: 'g1', recordId: 'r1' });
    expect(upsert.mock.calls[0][0]).toEqual({ table: 'pedidos', data: { assunto: 'Novo' }, id: 'r1' });
    expect(upsert.mock.calls[0][3]).toEqual({ updateOnly: true });
  });
});
