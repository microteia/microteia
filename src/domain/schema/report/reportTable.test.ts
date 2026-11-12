import { describe, it, expect } from 'vitest';
import { buildReportTable } from './reportTable';
import type { ReportTableText } from './reportTable';
import type { ReportSpec } from './reportSpec';
import type { ReportResult } from './reportResult';

const text: ReportTableText = {
  label: (value) => (value ?? '').toUpperCase(),
  group: (entry) => (entry ? `<${entry.key}>` : ''),
  cell: (record, dimension) => String(record[dimension.path] ?? ''),
  number: (value) => (value === null || value === undefined ? '' : String(value)),
  total: 'Total',
  partial: (scanned) => `parcial ${scanned}`,
};

const base: Omit<ReportResult, 'rows' | 'shape'> = {
  columns: [], totals: { values: { soma: 30 }, count: 3 }, scanned: 3, complete: true, completeGroups: true,
  generatedAt: '2026-11-12T00:00:00.000Z',
};

describe('buildReportTable — uma tabela para a tela e para o arquivo da automação', () => {
  it('resumo: o grupo pelo texto do grupo, a medida pelo texto do número, e o total', () => {
    const spec: ReportSpec = {
      v: 1,
      dataset: { table: 't', dimensions: [{ key: 'sit', path: 'sit', label: 'situação' }], measures: [{ key: 'soma', op: 'sum', path: 'v', label: 'soma' }] },
      shape: { kind: 'summary', groupBy: [{ dimension: 'sit' }], values: ['soma'] },
    };
    const table = buildReportTable(spec, {
      ...base, shape: 'summary',
      rows: [{ keys: [{ dimension: 'sit', key: 'aberto' }], values: { soma: 30 }, count: 3, level: 0 }],
    }, text);
    expect(table).toEqual({ header: ['SITUAÇÃO', 'SOMA'], rows: [['<aberto>', '30']], totals: ['Total', '30'] });
  });

  it('o parcial vai no próprio arquivo', () => {
    const spec: ReportSpec = {
      v: 1, dataset: { table: 't', dimensions: [{ key: 'a', path: 'a' }] }, shape: { kind: 'tabular', columns: ['a'] },
    };
    const table = buildReportTable(spec, { ...base, shape: 'tabular', rows: [], totals: null, records: [{ a: 'x' }], complete: false }, text);
    expect(table).toEqual({ header: ['a'], rows: [['x']], notice: 'parcial 3' });
  });
});
