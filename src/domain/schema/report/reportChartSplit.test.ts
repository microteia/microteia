import { describe, expect, it } from 'vitest';
import { reportChartSplit } from './reportChartSplit';
import type { ReportChart, ReportShape, ReportSpec } from './reportSpec';

const specOf = (shape: ReportShape, chart: ReportChart): ReportSpec => ({
  v: 1,
  dataset: {
    table: 'lancamentos',
    dimensions: [
      { key: 'ano', path: 'ano' },
      { key: 'mes', path: 'mes' },
      { key: 'situacao', path: 'situacao' },
    ],
    measures: [{ key: 'total', op: 'count' }],
  },
  shape,
  presentation: { chart },
});

const resumo = (subtotal = false): ReportShape => ({
  kind: 'summary',
  groupBy: [{ dimension: 'ano', subtotal }, { dimension: 'mes', subtotal }, { dimension: 'situacao' }],
  values: ['total'],
});

const pivo: ReportShape = {
  kind: 'matrix',
  rows: [{ dimension: 'mes' }],
  columns: [{ dimension: 'situacao' }],
  values: ['total'],
};

describe('reportChartSplit', () => {
  it('sem splitBy não há quebra', () => {
    expect(reportChartSplit(specOf(resumo(), { kind: 'bar' }))).toBeNull();
  });

  it('sem categoria, o eixo é o nível logo acima da quebra', () => {
    expect(reportChartSplit(specOf(resumo(), { kind: 'bar', splitBy: 'situacao' })))
      .toEqual({ source: 'level', categoryDepth: 1, splitDepth: 2 });
  });

  it('com categoria logo acima, quebra', () => {
    expect(reportChartSplit(specOf(resumo(true), { kind: 'bar', category: 'ano', splitBy: 'mes' })))
      .toEqual({ source: 'level', categoryDepth: 0, splitDepth: 1 });
  });

  it('com um nível entre o eixo e a quebra, não quebra — isso exigiria somar no cliente', () => {
    expect(reportChartSplit(specOf(resumo(), { kind: 'bar', category: 'ano', splitBy: 'situacao' })))
      .toBeNull();
  });

  it('o nível intermediário sem subtotal não tem linha, e por isso não quebra', () => {
    expect(reportChartSplit(specOf(resumo(false), { kind: 'bar', category: 'ano', splitBy: 'mes' })))
      .toBeNull();
  });

  it('a lista agrupada traz todos os níveis, com ou sem subtotal', () => {
    const lista: ReportShape = {
      kind: 'tabular',
      columns: ['situacao'],
      groupBy: [{ dimension: 'ano' }, { dimension: 'mes' }],
    };

    expect(reportChartSplit(specOf(lista, { kind: 'bar', category: 'ano', splitBy: 'mes' })))
      .toEqual({ source: 'level', categoryDepth: 0, splitDepth: 1 });
  });

  it('no pivô, a coluna vira legenda quando o eixo são as linhas', () => {
    expect(reportChartSplit(specOf(pivo, { kind: 'bar', category: 'mes', splitBy: 'situacao' })))
      .toEqual({ source: 'column', categoryDepth: 0 });
  });

  it('no pivô, a linha vira legenda quando o eixo são as colunas', () => {
    expect(reportChartSplit(specOf(pivo, { kind: 'bar', category: 'situacao', splitBy: 'mes' })))
      .toEqual({ source: 'row', splitDepth: 0 });
    expect(reportChartSplit(specOf(pivo, { kind: 'bar', splitBy: 'mes' })))
      .toEqual({ source: 'row', splitDepth: 0 });
  });

  it('a rosca não quebra', () => {
    expect(reportChartSplit(specOf(resumo(), { kind: 'donut', splitBy: 'situacao' }))).toBeNull();
  });

  it('dimensão que a dobra não agrupa não quebra', () => {
    const raso: ReportShape = { kind: 'summary', groupBy: [{ dimension: 'mes' }], values: ['total'] };

    expect(reportChartSplit(specOf(raso, { kind: 'bar', splitBy: 'situacao' }))).toBeNull();
  });
});
