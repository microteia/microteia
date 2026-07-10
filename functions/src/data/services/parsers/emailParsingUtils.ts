const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  iacute: 'í', igrave: 'ì', icirc: 'î', iuml: 'ï',
  oacute: 'ó', ograve: 'ò', ocirc: 'ô', otilde: 'õ', ouml: 'ö',
  uacute: 'ú', ugrave: 'ù', ucirc: 'û', uuml: 'ü',
  ccedil: 'ç', ntilde: 'ñ', yacute: 'ý',
  Aacute: 'Á', Agrave: 'À', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Aring: 'Å',
  Eacute: 'É', Egrave: 'È', Ecirc: 'Ê', Euml: 'Ë',
  Iacute: 'Í', Igrave: 'Ì', Icirc: 'Î', Iuml: 'Ï',
  Oacute: 'Ó', Ograve: 'Ò', Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö',
  Uacute: 'Ú', Ugrave: 'Ù', Ucirc: 'Û', Uuml: 'Ü',
  Ccedil: 'Ç', Ntilde: 'Ñ',
  ordf: 'ª', ordm: 'º', deg: '°', middot: '·', sect: '§',
  laquo: '«', raquo: '»', ndash: '–', mdash: '—', hellip: '…', bull: '•',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  copy: '©', reg: '®', trade: '™', euro: '€',
};

/**
 * Decodifica entidades HTML nomeadas (á, ç, ª, …) e numéricas (&#233; / &#xE9;).
 * Nunca apaga entidades desconhecidas — mantém o texto original nesse caso.
 */
export function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (whole, name: string) => NAMED_ENTITIES[name] ?? whole);
}

function safeFromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/**
 * Converte HTML em texto puro preservando quebras de linha semânticas.
 * <br> e tags de bloco viram \n; script/style são removidos; entidades são decodificadas.
 */
export function htmlToText(html: string): string {
  if (!html) return '';
  const withBreaks = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|table|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<\/?(td|th|li)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return normalizeWhitespace(decodeHtmlEntities(withBreaks));
}

/**
 * Colapsa espaços/linhas em branco redundantes mantendo a estrutura de linhas.
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Remove acentos (defesa contra rótulos acentuados / mojibake residual). */
export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Constrói o fragmento de regex de um rótulo tolerando acento/mojibake:
 * cada caractere não-ASCII vira '.' (casa o acento correto ou o char corrompido);
 * caracteres ASCII especiais de regex são escapados.
 */
export function accentInsensitiveSource(label: string): string {
  return label
    .split('')
    .map((ch) => {
      if (ch.charCodeAt(0) > 127) return '.';
      return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
}

/**
 * Extrai o valor associado a um rótulo. Cobre "Rótulo: valor" na mesma linha
 * e o layout de tabela "Rótulo\nvalor" (valor na linha seguinte).
 */
export function labeledValue(text: string, label: string): string | undefined {
  const src = `(?<![^\\n])${accentInsensitiveSource(label)}`;
  const sameLine = text.match(new RegExp(`${src}[ \\t]*:?[ \\t]*([^\\n]+)`, 'i'));
  if (sameLine && sameLine[1].trim()) return sameLine[1].trim();
  const nextLine = text.match(new RegExp(`${src}[ \\t]*:?[ \\t]*\\n[ \\t]*([^\\n]+)`, 'i'));
  if (nextLine && nextLine[1].trim()) return nextLine[1].trim();
  return undefined;
}

export const CNJ_MASKED_REGEX = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/;
const CNJ_RAW_REGEX = /(?<!\d)\d{20}(?!\d)/;

/** Normaliza um número de processo (mascarado ou 20 dígitos) para o padrão CNJ. */
export function formatCNJ(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 20) {
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
  }
  return raw.trim();
}

/** Extrai o primeiro número CNJ (mascarado ou cru) encontrado, já formatado. */
export function findCNJ(text: string): string | undefined {
  const masked = text.match(CNJ_MASKED_REGEX);
  if (masked) return masked[0];
  const raw = text.match(CNJ_RAW_REGEX);
  if (raw) return formatCNJ(raw[0]);
  return undefined;
}

/** Portão para a IA: só vale a pena acionar se houver ao menos um CNJ no conteúdo. */
export function hasCNJ(text: string): boolean {
  return CNJ_MASKED_REGEX.test(text) || CNJ_RAW_REGEX.test(text);
}

/** Converte "DD/MM/YYYY" (com hora opcional "HH:MM[:SS]") em Date local. */
export function parseBrDate(value: string): Date | undefined {
  const m = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return undefined;
  const [, day, month, year, hour, minute, second] = m;
  return new Date(
    Number(year), Number(month) - 1, Number(day),
    Number(hour ?? 0), Number(minute ?? 0), Number(second ?? 0),
  );
}

const MONTHS: Record<string, number> = {
  janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

/** Converte "4 de Novembro de 2015 [às 16:42]" em Date local. */
export function parseExtenseDate(value: string): Date | undefined {
  const m = value.match(/(\d{1,2})\s+de\s+([A-Za-zçÇãÃéÉ]+)\s+de\s+(\d{4})(?:\s+[àa]s?\s+(\d{1,2}):(\d{2}))?/i);
  if (!m) return undefined;
  const month = MONTHS[stripAccents(m[2]).toLowerCase()];
  if (month === undefined) return undefined;
  return new Date(Number(m[3]), month, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0));
}
