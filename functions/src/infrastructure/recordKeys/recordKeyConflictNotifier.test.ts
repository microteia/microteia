import { describe, expect, it, vi } from 'vitest';
import { notifyRecordKeyConflicts } from './recordKeyConflictNotifier';
import { createSchemaContext } from '../../domain/schema/screenEntity';
import type { RecordKeyAdoptionState } from '../../domain/schema/recordKeyAdoption';
import type { DispatchNotificationUseCase } from '../../domain/usecases/DispatchNotificationUseCase';

const field = (key: string, label: string) => ({ key, label, type: 'text' as const, required: false, order: 0, origin: 'plugin' as const });

const ctx = createSchemaContext([{
  id: 'movimentacoes',
  titleSingular: 'Movimentação',
  titlePlural: 'Movimentações',
  titleFieldKey: 'movementType',
  fields: [field('date', 'Data'), field('time', 'Hora'), field('movementType', 'Tipo')],
  keys: [{ name: 'fato', kind: 'unique', fields: ['date', 'time', 'movementType'] }],
}]);

const state = (issueCount: number): RecordKeyAdoptionState => ({
  status: 'done', pending: { fato: 'sig' }, adopted: {}, generation: 1, round: 1, cursor: null, leaseUntil: null,
  touchedAt: 0, attempts: 0, processed: 10, reserved: 8, failed: 0, failedIds: [], issues: [], issueCount, blocked: [],
  recheck: false,
});

const deps = () => {
  const execute = vi.fn(async () => ({ recipients: 1, delivered: {}, failed: {}, issues: [] }));
  return {
    execute,
    deps: {
      schemaContext: async () => ctx,
      messageBundles: async () => [],
      officeLocale: async () => 'pt-BR',
      dispatch: { execute } as unknown as DispatchNotificationUseCase,
    },
  };
};

describe('notifyRecordKeyConflicts', () => {
  it('nomeia a tela e a chave como a pessoa as lê — os rótulos dos campos — e leva à listagem', async () => {
    const { deps: d, execute } = deps();
    await notifyRecordKeyConflicts(d, 't1', 'movimentacoes', state(2));
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      params: { screen: 'Movimentações', keys: 'Data + Hora + Tipo', count: '2' },
      link: 'dyn:movimentacoes',
    }));
  });

  it('sem conflito, não lê nada e não avisa', async () => {
    const { deps: d, execute } = deps();
    await notifyRecordKeyConflicts(d, 't1', 'movimentacoes', state(0));
    expect(execute).not.toHaveBeenCalled();
  });
});
