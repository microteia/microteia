// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { createSchemaContext } from '../../../../domain/schema/pathResolver';
import type { SchemaScreen } from '../../../../domain/schema/pathResolver';
import { baseDarkTheme } from '../../../../shared/styles/theme';
import type { ReportResult, ReportRow } from '../../../../domain/schema/report/reportResult';
import type { ReportSpec } from '../../../../domain/schema/report/reportSpec';

const lancamentos: SchemaScreen = {
  id: 'lancamentos',
  titleSingular: 'Lançamento',
  titleFieldKey: 'titulo',
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', required: false, order: 0, origin: 'design' },
    { key: 'situacao', label: 'Situação', type: 'text', required: false, order: 1, origin: 'design' },
    { key: 'mes', label: 'Mês', type: 'text', required: false, order: 2, origin: 'design' },
  ],
};

vi.mock('../../../shared/useSchemaContext', () => ({
  useSchemaContext: () => createSchemaContext([lancamentos], []),
}));

vi.mock('../../../hooks/useCustomFieldListing', () => ({
  useCustomFieldListing: () => ({
    displayValue: (row: Record<string, unknown>, field: { key: string }) => String(row[field.key] ?? ''),
  }),
}));

const { useReportChartViewModel } = await import('./ReportChart.viewmodel');

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(ThemeProvider, { theme: baseDarkTheme }, children);

const vmOf = (spec: ReportSpec, result: ReportResult | null) =>
  renderHook(() => useReportChartViewModel(spec, result), { wrapper }).result.current;

const dataset: ReportSpec['dataset'] = {
  table: 'lancamentos',
  dimensions: [
    { key: 'mes', path: 'mes' },
    { key: 'situacao', path: 'situacao' },
  ],
  measures: [{ key: 'total', op: 'count' }],
};

const row = (keys: [string, string][], total: number, level: number, subtotal?: boolean): ReportRow => ({
  keys: keys.map(([dimension, key]) => ({ dimension, key })),
  values: { total },
  count: total,
  level,
  ...(subtotal ? { subtotal: true } : {}),
});

const resultOf = (rows: ReportRow[], shape = 'summary'): ReportResult => ({
  shape,
  columns: [],
  rows,
  totals: null,
  scanned: 10,
  complete: true,
  completeGroups: true,
  generatedAt: '2026-09-06T00:00:00.000Z',
});

const AGRUPADO: ReportSpec = {
  v: 1,
  dataset,
  shape: {
    kind: 'summary',
    groupBy: [{ dimension: 'mes', subtotal: true }, { dimension: 'situacao' }],
    values: ['total'],
  },
  presentation: { chart: { kind: 'bar' } },
};

const LINHAS = [
  row([['mes', '2026-08']], 8, 0, true),
  row([['mes', '2026-08'], ['situacao', 'pago']], 5, 1),
  row([['mes', '2026-08'], ['situacao', 'aberto']], 3, 1),
  row([['mes', '2026-09']], 4, 0, true),
  row([['mes', '2026-09'], ['situacao', 'pago']], 4, 1),
];

describe('useReportChartViewModel', () => {
  it('sem categoria, cada grupo folha é um ponto', () => {
    const vm = vmOf(AGRUPADO, resultOf(LINHAS));

    expect(vm.mark).toBe('bar');
    expect(vm.data).toEqual([
      { name: 'pago', total: 5 },
      { name: 'aberto', total: 3 },
      { name: 'pago', total: 4 },
    ]);
  });

  it('a categoria declarada escolhe o NÍVEL do eixo', () => {
    const spec: ReportSpec = {
      ...AGRUPADO,
      presentation: { chart: { kind: 'bar', category: 'mes' } },
    };

    expect(vmOf(spec, resultOf(LINHAS)).data).toEqual([
      { name: '2026-08', total: 8 },
      { name: '2026-09', total: 4 },
    ]);
  });

  it('a lista simples não desenha moldura nenhuma', () => {
    // `tabular` devolve os registros em `records` e nunca em `rows`: o gráfico saía uma caixa vazia
    // ao lado de uma tabela cheia, e quem o configurou não tinha como saber por quê.
    const spec: ReportSpec = {
      v: 1,
      dataset,
      shape: { kind: 'tabular', columns: ['situacao'] },
      presentation: { chart: { kind: 'bar' } },
    };
    const result: ReportResult = { ...resultOf([], 'tabular'), records: [{ situacao: 'pago' }] };

    expect(vmOf(spec, result).mark).toBeNull();
  });

  it('sem medida a desenhar, não desenha', () => {
    const spec: ReportSpec = {
      ...AGRUPADO,
      presentation: { chart: { kind: 'bar', series: ['fantasma'] } },
    };

    expect(vmOf(spec, resultOf(LINHAS)).mark).toBeNull();
  });

  it('sem resultado nenhum, não desenha', () => {
    expect(vmOf(AGRUPADO, resultOf([])).mark).toBeNull();
  });

  it('a marca que este kernel não conhece não desenha', () => {
    const spec: ReportSpec = {
      ...AGRUPADO,
      presentation: { chart: { kind: 'com.acme.charts/sankey' } },
    };

    expect(vmOf(spec, resultOf(LINHAS)).mark).toBeNull();
  });
});
