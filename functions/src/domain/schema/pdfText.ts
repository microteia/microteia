// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/pdfText.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/pdfText.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * O texto de UMA página de PDF a partir dos trechos que o `pdfjs-dist` devolve (`getTextContent`).
 *
 * Mora aqui, e não dentro de quem lê, porque são dois leitores — o Processador no navegador e, no
 * servidor, o passo que lê documento — e um leitor determinístico de layout conhecido é escrito contra
 * o TEXTO. Duas junções diferentes do mesmo PDF quebrariam esse leitor em silêncio, num dos dois lados.
 *
 * - `flat`: tudo numa linha, espaços colapsados. É o que o Processador sempre mandou à IA, e continua
 *   sendo o padrão para não mudar a entrada de quem já depende dele.
 * - `lines`: preserva a quebra que o PDF marca (`hasEOL`), com cada linha aparada e as vazias fora — o
 *   que um leitor de layout costuma querer.
 */
export type PdfTextLayout = 'flat' | 'lines';

export const PDF_TEXT_LAYOUTS: readonly PdfTextLayout[] = ['flat', 'lines'];

export interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
}

export const pdfPageText = (items: readonly PdfTextItem[], layout: PdfTextLayout = 'flat'): string => {
  if (layout === 'flat') {
    return items
      .map((item) => item.str ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const lines: string[] = [];
  let current: string[] = [];
  for (const item of items) {
    current.push(item.str ?? '');
    if (item.hasEOL) {
      lines.push(current.join(' '));
      current = [];
    }
  }
  if (current.length > 0) lines.push(current.join(' '));
  return lines
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n');
};
