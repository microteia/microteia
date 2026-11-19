import { useMemo } from 'react';
import { useLabel, useLocaleFormat, useT } from '../../../shared/i18n/useT';
import { useReportCellText } from '../../../shared/report/useReportCellText';
import { useReportSchema } from '../../../shared/report/useReportSchema';
import { fieldAtPath } from '../../../shared/report/reportFilterFields';
import { columnLabel, formatMeasureValue } from '../../../shared/report/reportFormatting';
import { getValueAtPath, parsePath } from '../../../../domain/schema/pathResolver';
import { reportDrillColumns } from '../../../../domain/schema/report/reportSpec';
import type { ReportDrillColumn, ReportSpec } from '../../../../domain/schema/report/reportSpec';
import type { ReportDrillTarget } from '../../../../domain/schema/report/aggregateRows';

export interface ReportDrillViewModel {
  columns: { key: string; label: string }[];
  rows: { id: string; cells: string[] }[];
  /** "Mostrando 500 de 812" quando o teto cortou; `null` quando tudo coube. */
  truncated: string | null;
  emptyMessage: string;
  loadingMessage: string;
}

/**
 * Os registros de um recorte, como a tela os lista.
 *
 * As colunas saem de `reportDrillColumns` — as declaradas em `drillDown.columns` ou, sem elas, as
 * outras dimensões e o campo de cada medida mostrada —, sem a dimensão do recorte clicado. Todas já
 * vêm na varredura: pedir outros campos aqui obrigaria uma segunda leitura, com outra permissão a
 * cobrar, para mostrar o que o relatório nunca afirmou.
 */
export const useReportDrillViewModel = (
  spec: ReportSpec,
  target: ReportDrillTarget | null,
  records: Record<string, unknown>[],
  matched: number,
): ReportDrillViewModel => {
  const label = useLabel();
  const t = useT('core.reports');
  const formatters = useLocaleFormat();
  const cellText = useReportCellText(spec);
  const { ctx, table } = useReportSchema(spec);

  const columns = useMemo(
    () => reportDrillColumns(spec, target ? [...target.keys, ...(target.column ?? [])] : []),
    [spec, target],
  );

  return useMemo(() => {
    // A coluna de MEDIDA leva o nome do CAMPO, não o da medida: a linha mostra o valor de um
    // registro, e "Total" sobre ele afirmaria uma soma que não está ali.
    const headerOf = (column: ReportDrillColumn): string => (column.kind === 'dimension'
      ? columnLabel(column.dimension.label, column.key, label)
      : columnLabel(fieldAtPath(ctx, table, column.path)?.label ?? column.measure.label, column.path, label));

    const textOf = (record: Record<string, unknown>, column: ReportDrillColumn): string => {
      if (column.kind === 'dimension') return cellText(record, column.dimension);
      const value = getValueAtPath(record, parsePath(column.path));
      if (value === null || value === undefined) return '';
      return typeof value === 'number' ? formatMeasureValue(value, column.measure.format, formatters) : String(value);
    };

    return {
      columns: columns.map((column) => ({ key: column.key, label: headerOf(column) })),
      rows: records.map((record, index) => ({
        id: typeof record.id === 'string' ? record.id : String(index),
        cells: columns.map((column) => textOf(record, column)),
      })),
      truncated: matched > records.length
        ? t('drill.truncated', {
            shown: formatters.formatNumber(records.length, { maximumFractionDigits: 0 }),
            total: formatters.formatNumber(matched, { maximumFractionDigits: 0 }),
          })
        : null,
      emptyMessage: t('drill.empty'),
      loadingMessage: t('drill.loading'),
    };
  }, [columns, records, matched, label, t, formatters, cellText, ctx, table]);
};
