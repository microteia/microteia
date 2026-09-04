import { useCallback } from 'react';
import { useLabel, useT } from '../i18n/useT';
import { useReportGroupLabels } from './useReportGroupLabels';
import { columnLabel, rowDimensions, shownMeasures } from './reportFormatting';
import { reportCellKey } from '../../../domain/schema/report/aggregateRows';
import { reportCsvFileName, reportResultToCsv } from '../../../domain/schema/report/reportCsv';
import type { ReportResult } from '../../../domain/schema/report/reportResult';
import type { ReportSpec } from '../../../domain/schema/report/reportSpec';

/**
 * O número como uma PLANILHA o reimporta: cru, com ponto decimal.
 *
 * De propósito diferente da tela. O número formatado no idioma de quem lê — `1.234,50` — é lido
 * como texto por qualquer planilha, e o total da coluna deixaria de existir. O formatado é para
 * quem olha; o cru é para quem calcula.
 */
const rawNumber = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

export const useReportCsv = (
  spec: ReportSpec,
  result: ReportResult | null,
  title: string,
): (() => void) => {
  const label = useLabel();
  const groupLabel = useReportGroupLabels(spec);
  const t = useT('core.reports');

  return useCallback(() => {
    if (!result) return;

    const measures = shownMeasures(spec);
    const dimensions = rowDimensions(spec);
    const groupHeader = dimensions
      .map((dimension) => columnLabel(dimension.label, dimension.key, label))
      .join(' / ');

    const header = [groupHeader];
    const rows: string[][] = [];
    let totals: string[] | undefined;

    if (spec.shape.kind === 'matrix') {
      for (const column of result.columns) {
        const columnName = column.map((entry) => groupLabel(entry)).join(' / ');
        for (const measure of measures) {
          header.push(measures.length > 1
            ? `${columnName} — ${columnLabel(measure.label, measure.key, label)}`
            : columnName);
        }
      }
      for (const row of result.rows) {
        rows.push([
          groupLabel(row.keys[row.keys.length - 1]),
          ...result.columns.flatMap((column) => measures.map((measure) =>
            rawNumber(row.cells?.[reportCellKey(column)]?.[measure.key]))),
        ]);
      }
      if (result.columnTotals) {
        totals = [
          t('table.total'),
          ...result.columns.flatMap((column) => measures.map((measure) =>
            rawNumber(result.columnTotals?.[reportCellKey(column)]?.[measure.key]))),
        ];
      }
    } else {
      header.push(...measures.map((measure) => columnLabel(measure.label, measure.key, label)));
      for (const row of result.rows) {
        rows.push([
          groupLabel(row.keys[row.keys.length - 1]),
          ...measures.map((measure) => rawNumber(row.values[measure.key])),
        ]);
      }
      if (result.totals) {
        totals = [
          t('table.total'),
          ...measures.map((measure) => rawNumber(result.totals?.values[measure.key])),
        ];
      }
    }

    const csv = reportResultToCsv({
      header,
      rows,
      totals,
      notice: result.complete && result.completeGroups
        ? undefined
        : t('csv.partial', { scanned: String(result.scanned) }),
    });

    // O mesmo gesto de download que o Marketplace e as Traduções já usam.
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = reportCsvFileName(title, new Date(result.generatedAt));
    anchor.click();
    URL.revokeObjectURL(url);
  }, [spec, result, title, label, groupLabel, t]);
};
