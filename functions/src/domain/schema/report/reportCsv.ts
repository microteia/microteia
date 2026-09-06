// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/report/reportCsv.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportCsv.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A TABELA já pronta para virar arquivo: cabeçalho, linhas e o aviso de parcial.
 *
 * Recebe texto, e não o resultado cru, porque quem sabe resolver um rótulo de opção e formatar um
 * número no idioma de quem lê é a apresentação. O que mora aqui é só o que não pode divergir entre
 * o botão "Exportar" de hoje e o relatório agendado de amanhã: a forma do arquivo.
 */
export interface ReportCsvTable {
  header: string[];
  rows: string[][];
  /** Linha de total, quando existe. */
  totals?: string[];
  /**
   * O cabeçalho PRÓPRIO do total, quando ele não tem as colunas do corpo.
   *
   * É o caso da lista simples: o corpo mostra campos do registro e o total mostra números
   * agregados. Sem um cabeçalho próprio, a soma cairia debaixo da coluna "Cliente" — um número
   * plausível lido como outra coisa. Presente, o total vira um bloco à parte, depois de uma linha
   * em branco.
   */
  totalsHeader?: string[];
  /**
   * Dito NO ARQUIVO quando o resultado é parcial.
   *
   * Uma planilha viaja por e-mail e sobrevive à tela que a gerou: se o aviso ficasse só no banner,
   * o número parcial chegaria ao destinatário sem nada dizendo que é parcial.
   */
  notice?: string;
}

/** O BOM do começo. Sem ele o Excel lê o arquivo como latin-1 e come todo acento. */
const BOM = '\uFEFF';

const RFC4180_SPECIAL = /[",\r\n]/;

const cell = (value: string): string =>
  RFC4180_SPECIAL.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const line = (values: string[]): string => values.map(cell).join(',');

export const reportResultToCsv = (table: ReportCsvTable): string => {
  const lines: string[] = [];
  if (table.notice) lines.push(line([table.notice]), '');
  lines.push(line(table.header));
  for (const row of table.rows) lines.push(line(row));
  if (table.totals) {
    if (table.totalsHeader) lines.push('', line(table.totalsHeader));
    lines.push(line(table.totals));
  }

  return BOM + lines.join('\r\n');
};

/** O nome do arquivo, sem o que um sistema de arquivos recusa. */
export const reportCsvFileName = (title: string, at: Date): string => {
  const slug = title.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase();
  const day = at.toISOString().slice(0, 10);
  return `${slug || 'relatorio'}-${day}.csv`;
};
