import { describe, expect, it } from 'vitest';
import {
  AGGREGATE_BACKFILL_MAX_ATTEMPTS,
  AGGREGATE_BACKFILL_STALL_MS,
  aggregationSignature,
  declaredAggregationSignatures,
  planAggregateBackfill,
  readAggregateBackfillState,
} from './aggregateBackfill';
import type { AggregateBackfillState } from './aggregateBackfill';
import type { FieldAggregation } from './fieldRules';

const total: FieldAggregation = { from: 'itens', via: 'pedidoId', op: 'sum', field: 'valor' };
const quantidade: FieldAggregation = { from: 'itens', via: 'pedidoId', op: 'count' };

const NOW = 1_000_000_000;

const state = (overrides: Partial<AggregateBackfillState> = {}): AggregateBackfillState => ({
  ...readAggregateBackfillState({}),
  touchedAt: NOW,
  ...overrides,
});

describe('a assinatura de um agregado', () => {
  it('muda com o que muda o valor', () => {
    const base = aggregationSignature(total);
    expect(aggregationSignature({ ...total, from: 'outros' })).not.toBe(base);
    expect(aggregationSignature({ ...total, via: 'outroId' })).not.toBe(base);
    expect(aggregationSignature({ ...total, op: 'avg' })).not.toBe(base);
    expect(aggregationSignature({ ...total, field: 'peso' })).not.toBe(base);
    expect(aggregationSignature({ ...total, filter: 'ativo' })).not.toBe(base);
    expect(aggregationSignature({ ...total, op: 'latest', orderBy: [{ path: 'data', dir: 'desc' }] }))
      .not.toBe(aggregationSignature({ ...total, op: 'latest', orderBy: [{ path: 'data', dir: 'asc' }] }));
  });

  it('não muda com espaço em volta nem com vazio escrito de outro jeito', () => {
    const base = aggregationSignature(total);
    expect(aggregationSignature({ ...total, from: ' itens ', filter: '' })).toBe(base);
    expect(aggregationSignature({ ...total, filter: null, orderBy: null })).toBe(base);
  });

  it('só conta o agregado completo, e ignora o resto do campo', () => {
    const declared = declaredAggregationSignatures([
      { key: 'total', aggregation: total },
      { key: 'nome' },
      { key: 'meio', aggregation: { ...total, via: '' } },
    ]);
    expect(Object.keys(declared)).toEqual(['total']);
  });
});

describe('o plano do recálculo', () => {
  it('começa quando a tela declara um agregado e o job nunca existiu — o escritório anterior ao recálculo', () => {
    const plan = planAggregateBackfill({ total: aggregationSignature(total) }, null, NOW);
    expect(plan).toEqual({ kind: 'start', pending: { total: aggregationSignature(total) }, reconciled: {} });
  });

  it('não faz nada numa tela sem agregado', () => {
    expect(planAggregateBackfill({}, null, NOW)).toEqual({ kind: 'none' });
  });

  it('recalcula só o agregado novo — os que já funcionavam ficam de fora', () => {
    const reconciled = { total: aggregationSignature(total) };
    const declared = { ...reconciled, quantidade: aggregationSignature(quantidade) };
    const plan = planAggregateBackfill(declared, state({ reconciled }), NOW);
    expect(plan).toEqual({ kind: 'start', pending: { quantidade: aggregationSignature(quantidade) }, reconciled });
  });

  it('recalcula o agregado cuja declaração mudou', () => {
    const plan = planAggregateBackfill(
      { total: aggregationSignature({ ...total, op: 'avg' }) },
      state({ reconciled: { total: aggregationSignature(total) } }),
      NOW,
    );
    expect(plan.kind).toBe('start');
  });

  it('não refaz a passada em curso que já cobre a declaração', () => {
    const pending = { total: aggregationSignature(total) };
    expect(planAggregateBackfill(pending, state({ status: 'running', pending }), NOW)).toEqual({ kind: 'none' });
  });

  it('recomeça a passada em curso quando a declaração muda no meio dela', () => {
    const pending = { total: aggregationSignature(total) };
    const declared = { ...pending, quantidade: aggregationSignature(quantidade) };
    const plan = planAggregateBackfill(declared, state({ status: 'running', pending }), NOW);
    expect(plan).toEqual({ kind: 'start', pending: declared, reconciled: {} });
  });

  it('acorda a passada parada', () => {
    const pending = { total: aggregationSignature(total) };
    const stalled = state({ status: 'running', pending, touchedAt: NOW - AGGREGATE_BACKFILL_STALL_MS - 1 });
    expect(planAggregateBackfill(pending, stalled, NOW)).toEqual({ kind: 'nudge' });
  });

  it('confere de novo a passada que esperava a tela dos filhos', () => {
    const pending = { total: aggregationSignature(total) };
    expect(planAggregateBackfill(pending, state({ status: 'blocked', pending }), NOW)).toEqual({ kind: 'resume' });
  });

  it('esquece o agregado que saiu da declaração', () => {
    const plan = planAggregateBackfill({}, state({ reconciled: { total: aggregationSignature(total) } }), NOW);
    expect(plan).toEqual({ kind: 'settle', reconciled: {}, finish: true });
  });

  it('encerra a passada cujo único agregado saiu da declaração', () => {
    const pending = { total: aggregationSignature(total) };
    expect(planAggregateBackfill({}, state({ status: 'running', pending }), NOW))
      .toEqual({ kind: 'settle', reconciled: {}, finish: true });
  });

  it('não repete sem fim a passada que falhou em todas as tentativas', () => {
    const pending = { total: aggregationSignature(total) };
    const exhausted = state({ pending, failed: 2, attempts: AGGREGATE_BACKFILL_MAX_ATTEMPTS });
    expect(planAggregateBackfill(pending, exhausted, NOW)).toEqual({ kind: 'none' });
  });

  it('e volta a tentar quando a declaração muda depois disso', () => {
    const pending = { total: aggregationSignature(total) };
    const exhausted = state({ pending, failed: 2, attempts: AGGREGATE_BACKFILL_MAX_ATTEMPTS });
    const plan = planAggregateBackfill({ total: aggregationSignature({ ...total, op: 'max' }) }, exhausted, NOW);
    expect(plan.kind).toBe('start');
  });

  it('esgotada, esquece um agregado removido sem apagar a falha que ainda vale', () => {
    const pending = { total: aggregationSignature(total) };
    const reconciled = { quantidade: aggregationSignature(quantidade) };
    const exhausted = state({ pending, reconciled, failed: 2, attempts: AGGREGATE_BACKFILL_MAX_ATTEMPTS });
    expect(planAggregateBackfill(pending, exhausted, NOW)).toEqual({ kind: 'settle', reconciled: {}, finish: false });
  });
});

describe('a leitura do documento do job', () => {
  it('não confia na forma — o que falta vale o neutro', () => {
    const read = readAggregateBackfillState({ status: 'x', pending: { a: 1, b: 's' }, failedIds: ['p1', 2] });
    expect(read.status).toBe('done');
    expect(read.pending).toEqual({ b: 's' });
    expect(read.failedIds).toEqual(['p1']);
    expect(read.cursor).toBeNull();
    expect(read.blocked).toEqual([]);
  });
});
