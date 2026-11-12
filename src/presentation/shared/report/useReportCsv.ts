import { useCallback } from 'react';
import { useLabel, useT } from '../i18n/useT';
import { useReportGroupLabels } from './useReportGroupLabels';
import { useReportCellText } from './useReportCellText';
import { reportFileName, reportResultToCsv } from '../../../domain/schema/report/reportCsv';
import { buildReportTable } from '../../../domain/schema/report/reportTable';
import { reportResultToXlsx, XLSX_MIME_TYPE } from '../../../domain/schema/report/reportXlsx';
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

export type ReportExportFormat = 'csv' | 'xlsx';

/**
 * Baixa o relatório como PLANILHA — CSV ou XLSX, a MESMA tabela nos dois (`ReportCsvTable`).
 *
 * O XLSX existe porque o número do CSV é texto que a planilha adivinha pelo idioma de quem abre; no
 * XLSX a célula diz que é número. O nome do arquivo é o `export.fileName` do relatório, quando
 * declarado, e o título dele quando não.
 */
export const useReportExport = (
  spec: ReportSpec,
  result: ReportResult | null,
  title: string,
): ((format: ReportExportFormat) => void) => {
  const label = useLabel();
  const groupLabel = useReportGroupLabels(spec);
  const cellText = useReportCellText(spec);
  const t = useT('core.reports');

  return useCallback((format: ReportExportFormat) => {
    if (!result) return;

    const table = buildReportTable(spec, result, {
      label,
      group: groupLabel,
      cell: cellText,
      number: rawNumber,
      total: t('table.total'),
      partial: (scanned) => t('csv.partial', { scanned: String(scanned) }),
    });

    const baseName = spec.presentation?.export?.fileName?.trim() || title;
    // O mesmo gesto de download que o Marketplace e as Traduções já usam.
    const blob = format === 'xlsx'
      ? new Blob([reportResultToXlsx(table, title) as BlobPart], { type: XLSX_MIME_TYPE })
      : new Blob([reportResultToCsv(table)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = reportFileName(baseName, new Date(result.generatedAt), format);
    anchor.click();
    URL.revokeObjectURL(url);
  }, [spec, result, title, label, groupLabel, cellText, t]);
};

/** O CSV — o gesto de antes, mantido para quem só exporta nesse formato. */
export const useReportCsv = (
  spec: ReportSpec,
  result: ReportResult | null,
  title: string,
): (() => void) => {
  const exportAs = useReportExport(spec, result, title);
  return useCallback(() => exportAs('csv'), [exportAs]);
};
