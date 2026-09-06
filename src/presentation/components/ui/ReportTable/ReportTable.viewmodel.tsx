import { useMemo } from 'react';
import { useLabel, useLocaleFormat, useT } from '../../../shared/i18n/useT';
import type { ReportResult } from '../../../../domain/schema/report/reportResult';
import type { ReportSpec } from '../../../../domain/schema/report/reportSpec';
import {
  columnLabel,
  formatMeasureValue,
  rowDimensions,
  shownMeasures,
} from '../../../shared/report/reportFormatting';
import { useReportCellText } from '../../../shared/report/useReportCellText';
import { useReportGroupLabels } from '../../../shared/report/useReportGroupLabels';

export interface ReportTableColumn {
  key: string;
  label: string;
  numeric: boolean;
}

export interface ReportTableRow {
  id: string;
  level: number;
  subtotal: boolean;
  /** O rótulo do grupo do nível MAIS FUNDO desta linha — o recuo diz de qual nível ele é. */
  group: string;
  values: string[];
}

export interface ReportTableViewModel {
  columns: ReportTableColumn[];
  rows: ReportTableRow[];
  totals: { label: string; values: string[] } | null;
  /** As colunas do rodapé, alinhadas ao corpo. Só na dobra AGRUPADA. */
  totalsColumns: ReportTableColumn[];
  /** As colunas que o CORPO preenche — todas menos a de grupo, quando ela existe. */
  valueColumns: ReportTableColumn[];
  /** A dobra tem coluna de grupo (agrupada) ou não (lista simples). */
  grouped: boolean;
  /**
   * O total da LISTA SIMPLES, numa frase.
   *
   * Ali o corpo mostra campos do registro e o total mostra números agregados: as duas faixas não têm
   * as mesmas colunas, e alinhá-las produziria um rodapé mais largo que a tabela. Uma linha só não
   * pode desalinhar.
   */
  totalsInline: string | null;
  isEmpty: boolean;
  emptyMessage: string;
}

export const useReportTableViewModel = (
  spec: ReportSpec,
  result: ReportResult | null,
): ReportTableViewModel => {
  const label = useLabel();
  const formatters = useLocaleFormat();
  const t = useT('core.reports');

  const groupLabel = useReportGroupLabels(spec);
  const cellText = useReportCellText(spec);
  const totalLabel = t('table.total');
  const emptyMessage = t('table.empty');

  return useMemo(() => {
    const measures = shownMeasures(spec);
    const dimensions = rowDimensions(spec);

    /*
     * A LISTA SIMPLES é outra tabela.
     *
     * Numa dobra `tabular` o agregador não devolve grupos: ele devolve os REGISTROS, em `records`, e
     * o número agregado fica só no total. Ler `rows` aqui — como o caminho agrupado faz — mostrava
     * "Nenhum dado" com a coleção cheia, que é exatamente a leitura errada.
     *
     * Uma coluna por dimensão declarada, e o valor lido do registro pelo caminho dela.
     */
    if (spec.shape.kind === 'tabular') {
      const columns: ReportTableColumn[] = dimensions.map((dimension) => ({
        key: dimension.key,
        label: columnLabel(dimension.label, dimension.key, label),
        numeric: false,
      }));

      const records = result?.records ?? [];
      const rows: ReportTableRow[] = records.map((record, index) => ({
        id: String((record as { id?: unknown }).id ?? index),
        level: 0,
        subtotal: false,
        group: '',
        values: dimensions.map((dimension) => cellText(record, dimension)),
      }));

      const totalsInline = result?.totals
        ? [
            totalLabel,
            ...measures.map((measure) => `${columnLabel(measure.label, measure.key, label)}: `
              + formatMeasureValue(result.totals?.values[measure.key], measure.format, formatters)),
          ].join(' — ')
        : null;

      return {
        columns,
        rows,
        totals: null,
        // O total de uma lista simples é um RODAPÉ à parte: ele conta e soma o que a lista mostra, e
        // as colunas dele não são as colunas dela.
        totalsColumns: [],
        valueColumns: columns,
        grouped: false,
        totalsInline,
        isEmpty: rows.length === 0,
        emptyMessage,
      };
    }

    const columns: ReportTableColumn[] = [
      // Um cabeçalho só para a coluna de grupos: os níveis aparecem pelo RECUO, não por uma coluna
      // cada. Uma coluna por nível deixaria a tabela vazia à esquerda em toda linha funda.
      {
        key: '__group',
        label: dimensions.map((dimension) => columnLabel(dimension.label, dimension.key, label)).join(' / '),
        numeric: false,
      },
      ...measures.map((measure) => ({
        key: measure.key,
        label: columnLabel(measure.label, measure.key, label),
        numeric: true,
      })),
    ];

    const rows: ReportTableRow[] = (result?.rows ?? []).map((row, index) => ({
      id: `${index}:${row.keys.map((entry) => entry.key).join('/')}`,
      level: row.level,
      subtotal: row.subtotal === true,
      group: groupLabel(row.keys[row.keys.length - 1]),
      values: measures.map((measure) => formatMeasureValue(row.values[measure.key], measure.format, formatters)),
    }));

    const totals = result?.totals
      ? {
          label: totalLabel,
          values: measures.map((measure) =>
            formatMeasureValue(result.totals?.values[measure.key], measure.format, formatters)),
        }
      : null;

    return {
      columns,
      rows,
      totals,
      totalsColumns: columns.slice(1),
      valueColumns: columns.slice(1),
      grouped: true,
      totalsInline: null,
      isEmpty: rows.length === 0,
      emptyMessage,
    };
  }, [spec, result, label, formatters, groupLabel, cellText, totalLabel, emptyMessage]);
};
