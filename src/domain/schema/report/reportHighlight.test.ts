import { describe, it, expect } from 'vitest';
import { reportHighlightTone } from './reportHighlight';
import type { ReportSpec } from './reportSpec';

const spec: ReportSpec = {
  v: 1,
  dataset: { table: 'lancamentos', measures: [{ key: 'saldo', op: 'sum', path: 'valor' }] },
  shape: { kind: 'tabular', columns: [] },
  presentation: {
    highlight: [
      { measure: 'saldo', op: 'lt', value: 0, tone: 'negative' },
      { measure: 'saldo', op: 'lt', value: 100, tone: 'warning' },
      { measure: 'saldo', op: 'gte', value: 1000, tone: 'positive' },
    ],
  },
};

describe('reportHighlightTone', () => {
  it('a primeira regra que casa vence, na ordem declarada', () => {
    expect(reportHighlightTone(spec, 'saldo', -5)).toBe('negative');
    expect(reportHighlightTone(spec, 'saldo', 50)).toBe('warning');
    expect(reportHighlightTone(spec, 'saldo', 5000)).toBe('positive');
    expect(reportHighlightTone(spec, 'saldo', 500)).toBeNull();
  });

  it('sem número não há tom — "menos que zero" não pinta o que não aconteceu', () => {
    expect(reportHighlightTone(spec, 'saldo', null)).toBeNull();
    expect(reportHighlightTone(spec, 'saldo', undefined)).toBeNull();
  });

  it('a regra de outra medida não vale para esta', () => {
    expect(reportHighlightTone(spec, 'outra', -5)).toBeNull();
  });
});
