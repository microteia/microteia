import { useMemo } from 'react';
import { useLabel, useLocaleFormat, useT } from '../../../shared/i18n/useT';
import { useReportCellText } from '../../../shared/report/useReportCellText';
import { columnLabel } from '../../../shared/report/reportFormatting';
import type { ReportSpec } from '../../../../domain/schema/report/reportSpec';

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
 * As colunas são as DIMENSÕES do relatório — os campos que ele já lê e que a varredura trouxe
 * hidratados. Pedir outros campos aqui obrigaria uma segunda leitura, com outra permissão a cobrar,
 * para mostrar o que o relatório nunca afirmou.
 */
export const useReportDrillViewModel = (
  spec: ReportSpec,
  records: Record<string, unknown>[],
  matched: number,
): ReportDrillViewModel => {
  const label = useLabel();
  const t = useT('core.reports');
  const { formatNumber } = useLocaleFormat();
  const cellText = useReportCellText(spec);

  return useMemo(() => {
    const dimensions = spec.dataset.dimensions ?? [];
    return {
      columns: dimensions.map((dimension) => ({
        key: dimension.key,
        label: columnLabel(dimension.label, dimension.key, label),
      })),
      rows: records.map((record, index) => ({
        id: typeof record.id === 'string' ? record.id : String(index),
        cells: dimensions.map((dimension) => cellText(record, dimension)),
      })),
      truncated: matched > records.length
        ? t('drill.truncated', {
            shown: formatNumber(records.length, { maximumFractionDigits: 0 }),
            total: formatNumber(matched, { maximumFractionDigits: 0 }),
          })
        : null,
      emptyMessage: t('drill.empty'),
      loadingMessage: t('drill.loading'),
    };
  }, [spec, records, matched, label, t, formatNumber, cellText]);
};
