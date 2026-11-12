import type { ReportCsvTable } from '../../../domain/schema/report/reportCsv';
import { blocksToPdf } from './blocksToPdf';
import type { Block, CellAlign, Span } from './markdownBlocks';

const NUMERIC = /^[-+]?[\d.,\s]+%?$/;

const spans = (text: string, bold = false): Span[] => [{ text, ...(bold ? { bold: true } : {}) }];

/**
 * O relatório em PDF pelo motor de Documentos — o mesmo `blocksToPdf` dos modelos, sem exigir um modelo
 * por relatório: título, o aviso de parcial (quando há) e a tabela. A coluna em que todo valor é número
 * vai à direita, como numa planilha; o total entra como última linha, em negrito.
 */
export const reportTableToPdf = (table: ReportCsvTable, title: string): Promise<Buffer> => {
  const body = [...table.rows, ...(table.totals && !table.totalsHeader ? [table.totals] : [])];
  const align: CellAlign[] = table.header.map((_, column) =>
    (column > 0 && body.length > 0 && body.every((row) => (row[column] ?? '') === '' || NUMERIC.test(row[column] ?? ''))
      ? 'right'
      : 'left'));
  const lastIsTotal = table.totals !== undefined && !table.totalsHeader;

  const blocks: Block[] = [
    { kind: 'heading', level: 1, spans: spans(title) },
    ...(table.notice ? [{ kind: 'paragraph' as const, spans: spans(table.notice) }] : []),
    {
      kind: 'table',
      align,
      header: table.header.map((cell) => spans(cell, true)),
      rows: body.map((row, index) => row.map((cell) => spans(cell, lastIsTotal && index === body.length - 1))),
    },
    // Na lista simples o total tem colunas próprias — as das medidas —, e vai num bloco à parte.
    ...(table.totals && table.totalsHeader
      ? [{
          kind: 'table' as const,
          align: table.totalsHeader.map((_, column): CellAlign => (column > 0 ? 'right' : 'left')),
          header: table.totalsHeader.map((cell) => spans(cell, true)),
          rows: [table.totals.map((cell) => spans(cell, true))],
        }]
      : []),
  ];
  return blocksToPdf(blocks, title);
};
