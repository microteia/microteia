// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { createSchemaContext } from '../../../../domain/schema/pathResolver';
import type { SchemaScreen } from '../../../../domain/schema/pathResolver';
import type { FieldDefinition } from '../../../../domain/entities/entitySchemas';
import type { ReportSpec } from '../../../../domain/schema/report/reportSpec';
import { REPORT_DIMENSION_SLOT } from '../../../../domain/schema/report/reportComputedDimension';
import { baseDarkTheme } from '../../../../shared/styles/theme';

const field = (partial: Partial<FieldDefinition> & { key: string }): FieldDefinition => ({
  label: partial.key,
  type: 'text',
  required: false,
  order: 0,
  origin: 'design',
  ...partial,
});

const SCREENS: SchemaScreen[] = [{
  id: 'invoices',
  collection: 'invoices',
  titleSingular: 'Invoice',
  titleFieldKey: 'number',
  fields: [
    field({ key: 'number' }),
    field({ key: 'unit' }),
    field({ key: 'referenceMonth', label: 'Reference month', type: 'date' }),
    field({ key: 'consumptionKwh', label: 'Consumption', type: 'number' }),
    field({ key: 'amount', label: 'Amount', type: 'number' }),
  ],
}];

vi.mock('../../../shared/useSchemaContext', () => ({
  useSchemaContext: () => createSchemaContext(SCREENS),
}));

const { ReportDrill } = await import('./ReportDrill.view');

/** O cenário da issue #5: um resumo de UM nível, por unidade, com o consumo e o valor somados. */
const SPEC: ReportSpec = {
  v: 1,
  dataset: {
    table: 'invoices',
    dimensions: [
      { key: 'unit', path: 'unit', label: 'Unit' },
      { key: 'month', path: 'referenceMonth', label: 'Month', granularity: 'month', timeZone: 'UTC' },
      { key: 'late', path: '', label: 'Days late', expression: 'dateDiff(today(), referenceMonth)' },
    ],
    measures: [
      { key: 'kwh', label: 'Total consumption', op: 'sum', path: 'consumptionKwh' },
      { key: 'total', label: 'Total', op: 'sum', path: 'amount', format: { kind: 'integer' } },
    ],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'unit' }], values: ['kwh', 'total'] },
};

const RECORDS: Record<string, unknown>[] = [
  { id: 'a', unit: 'North', referenceMonth: '2026-03-10', consumptionKwh: 120, amount: 300, [REPORT_DIMENSION_SLOT]: { late: 4 } },
  { id: 'b', unit: 'North', referenceMonth: '2026-04-10', consumptionKwh: 80, amount: 210, [REPORT_DIMENSION_SLOT]: { late: 0 } },
];

const renderDrill = (spec: ReportSpec): HTMLElement => {
  render(
    <ThemeProvider theme={baseDarkTheme}>
      <ReportDrill
        spec={spec}
        target={{ keys: [{ dimension: 'unit', key: 'North' }] }}
        title="North"
        records={RECORDS}
        matched={RECORDS.length}
        isLoading={false}
        onOpenRecord={() => {}}
        onClose={() => {}}
      />
    </ThemeProvider>,
  );
  return screen.getByRole('table');
};

const headers = (table: HTMLElement): string[] =>
  within(table).getAllByRole('columnheader').map((cell) => cell.textContent ?? '');

describe('ReportDrill — as colunas do detalhe (#5)', () => {
  it('sem colunas declaradas: sem a unidade clicada, com as outras dimensões e as parcelas somadas', () => {
    const table = renderDrill(SPEC);

    // A coluna de medida leva o nome do CAMPO: a linha é um registro, não um total.
    expect(headers(table)).toEqual(['Month', 'Days late', 'Consumption', 'Amount']);
    const [first] = within(table).getAllByRole('row').slice(1);
    expect(within(first).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['2026-03', '4', '120', '300']);
  });

  it('com colunas declaradas: só elas, na ordem do autor', () => {
    const table = renderDrill({ ...SPEC, presentation: { drillDown: { columns: ['late', 'unit', 'month'] } } });

    expect(headers(table)).toEqual(['Days late', 'Month']);
  });
});
