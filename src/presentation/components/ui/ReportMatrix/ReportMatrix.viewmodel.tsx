import { useMemo } from 'react';
import { useLabel, useLocaleFormat, useT } from '../../../shared/i18n/useT';
import { reportCellKey } from '../../../../domain/schema/report/aggregateRows';
import type { ReportResult } from '../../../../domain/schema/report/reportResult';
import type { ReportHighlightTone, ReportSpec } from '../../../../domain/schema/report/reportSpec';
import { reportHighlightTone } from '../../../../domain/schema/report/reportHighlight';
import {
  columnLabel,
  formatMeasureValue,
  rowDimensions,
  shownMeasures,
} from '../../../shared/report/reportFormatting';
import { useReportGroupLabels } from '../../../shared/report/useReportGroupLabels';

export interface ReportMatrixViewModel {
  /** O canto superior esquerdo: os nomes das dimensões das linhas. */
  corner: string;
  /** Uma entrada por coluna do pivô, cada uma com uma célula por medida. */
  columns: { key: string; label: string }[];
  measures: { key: string; label: string }[];
  rows: { id: string; level: number; subtotal: boolean; group: string; cells: string[]; tones: (ReportHighlightTone | null)[] }[];
  totals: { label: string; cells: string[]; tones: (ReportHighlightTone | null)[] } | null;
  isEmpty: boolean;
  emptyMessage: string;
}

export const useReportMatrixViewModel = (
  spec: ReportSpec,
  result: ReportResult | null,
): ReportMatrixViewModel => {
  const label = useLabel();
  const formatters = useLocaleFormat();
  const t = useT('core.reports');

  const groupLabel = useReportGroupLabels(spec);
  const totalLabel = t('table.total');
  const emptyMessage = t('table.empty');

  return useMemo(() => {
    const measures = shownMeasures(spec);
    const dimensions = rowDimensions(spec);

    // Zero e vazio não são a mesma afirmação: `blank` diz "não houve", `zero` diz "houve e deu
    // zero". A dobra escolhe, e o padrão é mostrar o número que o agregado calculou.
    const blankWhenMissing = spec.shape.kind === 'matrix' && spec.shape.emptyCell === 'blank';

    const columns = (result?.columns ?? []).map((path) => ({
      key: reportCellKey(path),
      label: path.map((entry) => groupLabel(entry)).join(' / '),
    }));

    const cellsOf = (
      byColumn: Record<string, Record<string, number | null>> | undefined,
    ): string[] => columns.flatMap((column) => measures.map((measure) => {
      const value = byColumn?.[column.key]?.[measure.key];
      if (blankWhenMissing && (value === undefined || value === 0)) return '';
      return formatMeasureValue(value, measure.format, formatters);
    }));

    // O tom acompanha a célula, na mesma ordem: coluna por coluna, medida por medida.
    const tonesOf = (
      byColumn: Record<string, Record<string, number | null>> | undefined,
    ): (ReportHighlightTone | null)[] => columns.flatMap((column) => measures.map((measure) =>
      reportHighlightTone(spec, measure.key, byColumn?.[column.key]?.[measure.key])));

    const rows = (result?.rows ?? []).map((row, index) => ({
      id: `${index}:${row.keys.map((entry) => entry.key).join('/')}`,
      level: row.level,
      subtotal: row.subtotal === true,
      group: groupLabel(row.keys[row.keys.length - 1]),
      cells: cellsOf(row.cells),
      tones: tonesOf(row.cells),
    }));

    // O total de cada coluna vem do SERVIDOR. Somar as células exibidas daria o número errado em
    // toda medida que não é soma — média de médias não é média.
    const totals = result?.columnTotals
      ? { label: totalLabel, cells: cellsOf(result.columnTotals), tones: tonesOf(result.columnTotals) }
      : null;

    return {
      corner: dimensions.map((dimension) =>
        columnLabel(dimension.label, dimension.key, label)).join(' / '),
      columns,
      measures: measures.map((measure) => ({
        key: measure.key,
        label: columnLabel(measure.label, measure.key, label),
      })),
      rows,
      totals,
      isEmpty: rows.length === 0,
      emptyMessage,
    };
  }, [spec, result, label, formatters, groupLabel, totalLabel, emptyMessage]);
};
