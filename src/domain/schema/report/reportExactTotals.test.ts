import { describe, it, expect } from 'vitest';
import { exactTotalsPlan, withExactTotals } from './reportExactTotals';
import { createSchemaContext } from '../pathResolver';
import type { SchemaScreen } from '../pathResolver';
import type { ReportSpec } from './reportSpec';
import type { ReportResult } from './reportResult';

const faturas: SchemaScreen = {
  id: 'faturas',
  titleSingular: 'Fatura',
  titleFieldKey: 'numero',
  fields: [
    { key: 'numero', label: 'Número', type: 'text', required: false, order: 0, origin: 'design' },
    { key: 'valor', label: 'Valor', type: 'currency', required: false, order: 1, origin: 'design' },
    { key: 'clienteId', label: 'Cliente', type: 'reference', refEntity: 'faturas', required: false, order: 2, origin: 'design' },
  ],
};
const ctx = createSchemaContext([faturas], []);
const spec = (dataset: Partial<ReportSpec['dataset']> = {}): ReportSpec => ({
  v: 1,
  dataset: {
    table: 'faturas',
    dimensions: [{ key: 'numero', path: 'numero' }],
    measures: [{ key: 'n', op: 'count' }, { key: 'total', op: 'sum', path: 'valor' }],
    ...dataset,
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'numero' }], values: ['n', 'total'] },
});

describe('total respondido pelo banco', () => {
  it('contagem, soma e média sobre campo numérico do documento: o banco responde', () => {
    expect(exactTotalsPlan(spec(), ctx)).toEqual([
      { key: 'n', op: 'count' },
      { key: 'total', op: 'sum', path: 'valor' },
    ]);
  });

  it('o que só a memória faz tira o banco da conta — nunca um número diferente do de sempre', () => {
    expect(exactTotalsPlan(spec({ includeWhen: 'valor > 1' }), ctx)).toBeNull();
    expect(exactTotalsPlan(spec({ related: [{ table: 'faturas', via: 'clienteId', mode: 'with' }] }), ctx)).toBeNull();
    expect(exactTotalsPlan(spec({ scanLimit: 100 }), ctx)).toBeNull();
    expect(exactTotalsPlan(spec({ measures: [{ key: 'm', op: 'max', path: 'valor' }] }), ctx)).toBeNull();
    expect(exactTotalsPlan(spec({ measures: [{ key: 'd', op: 'count', path: 'numero', distinct: true }] }), ctx)).toBeNull();
    expect(exactTotalsPlan(spec({ measures: [{ key: 's', op: 'sum', path: 'numero' }] }), ctx)).toBeNull();
    expect(exactTotalsPlan(spec({
      measures: [{ key: 'f', op: 'count', filter: [{ path: 'numero', op: 'eq', value: { kind: 'Literal', value: '1' } }] }],
    }), ctx)).toBeNull();
  });

  it('os totais exatos substituem os parciais, e a medida calculada é refeita sobre eles', () => {
    const calculada = spec({
      measures: [
        { key: 'n', op: 'count' },
        { key: 'total', op: 'sum', path: 'valor' },
        { key: 'medio', kind: 'computed', expression: 'total / n' },
      ],
    });
    const parcial = {
      shape: 'summary', columns: [], rows: [], scanned: 2000, complete: false, completeGroups: true, generatedAt: '',
      totals: { count: 2000, values: { n: 2000, total: 4000, medio: 2 } },
    } as ReportResult;
    const exato = withExactTotals(parcial, calculada, { count: 5000, values: { n: 5000, total: 15000 } });
    expect(exato.totals).toEqual({ count: 5000, values: { n: 5000, total: 15000, medio: 3 } });
    expect(exato.totalsExact).toBe(true);
    expect(exato.complete).toBe(false);
  });
});
