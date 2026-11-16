// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/documentRead.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { LocalizedMessage } from './i18n/localizedMessage';

/**
 * O passo "Ler documento": o TEXTO de um documento da aba Documentos de um registro, para o passo seguinte
 * processar — um script que conhece o layout, a IA, uma condição.
 *
 * Antes dele, o conteúdo de um documento só chegava a uma automação pela tela do Processador, com uma
 * pessoa na frente. O anexo que chega por e-mail ou pelo portal, e a conta que o escritório arrasta para a
 * aba, ficavam fora de qualquer fluxo sem ninguém olhando.
 */
export const READ_DOCUMENT_STEP_ID = 'read-document';

/** O kernel a partir do qual o passo existe. */
export const READ_DOCUMENT_SINCE_KERNEL = '2.135.0';

/** O mesmo teto do upload pela aba (`storage.rules`): um documento maior não chega a existir. */
export const READ_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

/**
 * O separador entre páginas no `text`: o form feed, o mesmo do `pdftotext`. Uma saída por página dobraria o
 * texto no histórico da execução — que é UM documento de 1 MB —, e `text.split('\f')` devolve as páginas.
 */
export const READ_DOCUMENT_PAGE_SEPARATOR = '\f';

const TEXT_CONTENT_TYPES = ['application/json', 'application/xml'];

export type ReadableDocumentKind = 'pdf' | 'text';

/**
 * O que o passo sabe ler. Imagem e PDF escaneado ficam de fora de propósito: sem OCR, ler uma imagem seria
 * devolver vazio com cara de sucesso.
 */
export const readableDocumentKind = (contentType: string): ReadableDocumentKind | null => {
  const type = contentType.split(';')[0].trim().toLowerCase();
  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('text/') || TEXT_CONTENT_TYPES.includes(type)) return 'text';
  return null;
};

export type PageSelection =
  | { ok: true; pages: number[] }
  | ({ ok: false } & LocalizedMessage);

/**
 * As páginas pedidas, em ordem e sem repetir: vazio = todas; `"1"`, `"1-3"`, `"2,4"` ou a mistura. Uma
 * página que o documento não tem é recusa, e não omissão — o leitor que pediu a página 2 de uma conta que
 * veio com uma só precisa saber disso, e não receber outro texto.
 */
export const parsePageSelection = (spec: string, pageCount: number): PageSelection => {
  const trimmed = spec.trim();
  if (trimmed === '') return { ok: true, pages: Array.from({ length: pageCount }, (_, index) => index + 1) };

  const wanted = new Set<number>();
  for (const part of trimmed.split(',')) {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part);
    if (!match) {
      return { ok: false, message: '@core.automation/step.read-document.pages-invalid', messageParams: { pages: trimmed } };
    }
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);
    if (from < 1 || to < from) {
      return { ok: false, message: '@core.automation/step.read-document.pages-invalid', messageParams: { pages: trimmed } };
    }
    if (to > pageCount) {
      return {
        ok: false,
        message: '@core.automation/step.read-document.pages-out-of-range',
        messageParams: { pages: trimmed, count: String(pageCount) },
      };
    }
    for (let page = from; page <= to; page += 1) wanted.add(page);
  }
  return { ok: true, pages: [...wanted].sort((a, b) => a - b) };
};
