import { describe, it, expect } from 'vitest';
import { aggregateReportRows, drillReportRows } from './aggregateRows';
import { reportBucketOf } from './reportBuckets';
import { computedDimensionValue, materializeReportDimensions, REPORT_DIMENSION_SLOT } from './reportComputedDimension';
import { deriveReportRequires, unsupportedReportCapabilities } from './reportCapabilities';
import { reportPaths } from './reportSpec';
import type { ReportBucket, ReportSpec } from './reportSpec';
import { validateReportSpecShape } from './validateReportSpec';

const AGING: ReportBucket[] = [
  { key: 'a', label: '0–30', lt: 31 },
  { key: 'b', label: '31–60', lt: 61 },
  { key: 'c', label: '61+' },
];

const spec: ReportSpec = {
  v: 1,
  dataset: {
    table: 'faturas',
    dimensions: [{ key: 'atraso', path: '', label: 'Atraso', expression: 'dateDiff(today(), vencimento)', buckets: AGING }],
    measures: [{ key: 'total', op: 'sum', path: 'valor' }],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'atraso' }], values: ['total'] },
};

const NOW = new Date('2026-11-12T12:00:00Z');

const rows: Record<string, unknown>[] = [
  { id: '1', vencimento: '2026-11-02', valor: 100 },
  { id: '2', vencimento: '2026-10-01', valor: 200 },
  { id: '3', vencimento: '2026-08-01', valor: 50 },
  { id: '4', vencimento: '2026-11-10', valor: 10 },
  { id: '5', vencimento: null, valor: 7 },
];

const materialized = (input = rows) => {
  const outcome = materializeReportDimensions({ spec, rows: input, now: NOW, timeZone: 'UTC' });
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.rows;
};

describe('dimensão calculada', () => {
  it('calcula uma vez por linha, guardada fora dos campos do registro', () => {
    const [first] = materialized();
    expect(computedDimensionValue(first, 'atraso')).toBe(10);
    expect(first.vencimento).toBe('2026-11-02');
    expect(first[REPORT_DIMENSION_SLOT]).toEqual({ atraso: 10 });
  });

  it('agrupa pelas faixas, na ordem declarada, com o registro sem data no grupo vazio', () => {
    const result = aggregateReportRows({ spec, rows: materialized(), scanned: 5, complete: true, now: NOW });
    expect(result.rows.map((row) => [row.keys[0].key, row.keys[0].label, row.values.total])).toEqual([
      ['a', '0–30', 110],
      ['b', '31–60', 200],
      ['c', '61+', 50],
      ['', undefined, 7],
    ]);
  });

  it('o detalhamento acha a faixa pela mesma chave, e devolve o registro sem o valor calculado', () => {
    const drill = drillReportRows({ spec, rows: materialized(), target: { keys: [{ dimension: 'atraso', key: 'a' }] } });
    expect(drill.records.map((record) => record.id)).toEqual(['1', '4']);
    expect(drill.records[0]).not.toHaveProperty(REPORT_DIMENSION_SLOT);
  });

  it('a expressão que estoura é recusa nomeada, e não um grupo vazio', () => {
    const quebrada: ReportSpec = {
      ...spec,
      dataset: { ...spec.dataset, dimensions: [{ key: 'x', path: '', expression: 'naoExiste(valor)' }] },
    };
    const outcome = materializeReportDimensions({ spec: quebrada, rows, now: NOW });
    expect(outcome).toMatchObject({ ok: false, error: '@core.reports/dimension.expression.failed' });
  });

  it('o que a expressão lê entra nos caminhos do relatório — e o caminho vazio não', () => {
    expect(reportPaths(spec)).toEqual(['vencimento', 'valor']);
  });

  it('num kernel que não a conhece, a calculada RECUSA e a faixa só avisa', () => {
    expect(deriveReportRequires(spec)).toEqual(expect.arrayContaining(['dataset.dimension.expression', 'dimension.buckets']));
    expect(unsupportedReportCapabilities(spec, ['shape.summary', 'measure.aggregate', 'dataset.collection']))
      .toEqual(expect.arrayContaining(['dataset.dimension.expression', 'dimension.buckets']));
  });
});

describe('reportBucketOf', () => {
  it('a primeira faixa cujo limite o valor não alcança; o resto na faixa aberta', () => {
    expect(reportBucketOf(AGING, 0)?.key).toBe('a');
    expect(reportBucketOf(AGING, 30)?.key).toBe('a');
    expect(reportBucketOf(AGING, 31)?.key).toBe('b');
    expect(reportBucketOf(AGING, 500)?.key).toBe('c');
    expect(reportBucketOf(AGING, '45')?.key).toBe('b');
  });

  it('o que não é número não cai em faixa nenhuma', () => {
    expect(reportBucketOf(AGING, null)).toBeNull();
    expect(reportBucketOf(AGING, 'abc')).toBeNull();
    expect(reportBucketOf([{ key: 'a', lt: 10 }], 20)).toBeNull();
  });
});

describe('validação das faixas e da expressão', () => {
  const issuesOf = (dimension: ReportSpec['dataset']['dimensions']) =>
    validateReportSpecShape({ ...spec, dataset: { ...spec.dataset, dimensions: dimension } })
      .map((issue) => [issue.error, issue.severity ?? 'error']);

  it('limites fora de ordem, chave repetida ou duas faixas abertas são recusa', () => {
    expect(issuesOf([{ key: 'atraso', path: 'dias', buckets: [{ key: 'a', lt: 60 }, { key: 'b', lt: 30 }] }]))
      .toContainEqual(['@core.reports/dimension.buckets.invalid', 'error']);
    expect(issuesOf([{ key: 'atraso', path: 'dias', buckets: [{ key: 'a', lt: 30 }, { key: 'a' }] }]))
      .toContainEqual(['@core.reports/dimension.buckets.invalid', 'error']);
    expect(issuesOf([{ key: 'atraso', path: 'dias', buckets: [{ key: 'a' }, { key: 'b' }] }]))
      .toContainEqual(['@core.reports/dimension.buckets.invalid', 'error']);
  });

  it('expressão que não parseia é recusa', () => {
    expect(issuesOf([{ key: 'atraso', path: '', expression: 'valor +' }]))
      .toContainEqual(['@core.reports/dimension.expression.syntax', 'error']);
  });
});
