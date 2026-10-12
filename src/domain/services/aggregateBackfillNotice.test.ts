import { describe, expect, it } from 'vitest';
import { readAggregateBackfillState } from '../schema/aggregateBackfill';
import type { AggregateBackfillState } from '../schema/aggregateBackfill';
import { aggregateBackfillNotice } from './aggregateBackfillNotice';

const state = (overrides: Partial<AggregateBackfillState>): AggregateBackfillState => ({
  ...readAggregateBackfillState({}),
  ...overrides,
});

const label = (key: string): string => `<${key}>`;

describe('o aviso do recálculo na listagem', () => {
  it('não há aviso sem job, nem com a passada concluída sem problema', () => {
    expect(aggregateBackfillNotice(null, label)).toBeNull();
    expect(aggregateBackfillNotice(state({ status: 'done', written: 40 }), label)).toBeNull();
  });

  it('diz qual campo espera qual tela', () => {
    const notice = aggregateBackfillNotice(state({
      status: 'blocked',
      blocked: [{ field: 'total', from: 'itens' }, { field: 'qtd', from: 'itens' }],
    }), label);
    expect(notice).toEqual({
      messageKey: 'aggregate.backfill.blocked',
      params: { fields: '<total>, <qtd>', sources: 'itens' },
      variant: 'warning',
    });
  });

  it('explica o campo vazio enquanto a passada anda', () => {
    const notice = aggregateBackfillNotice(state({ status: 'running', pending: { total: 's' }, processed: 200 }), label);
    expect(notice?.messageKey).toBe('aggregate.backfill.running');
    expect(notice?.params.count).toBe('200');
  });

  it('conta os registros que não puderam ser recalculados', () => {
    const notice = aggregateBackfillNotice(state({ status: 'done', failed: 3, truncated: 2 }), label);
    expect(notice?.messageKey).toBe('aggregate.backfill.failed');
  });

  it('e os que passaram do teto de filhos', () => {
    const notice = aggregateBackfillNotice(state({ status: 'done', truncated: 2 }), label);
    expect(notice).toEqual({
      messageKey: 'aggregate.backfill.truncated',
      params: { count: '2', max: '500' },
      variant: 'info',
    });
  });
});
