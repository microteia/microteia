// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/i18n/localeFormat.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { LocaleCode } from './localeNegotiation';
import { DEFAULT_LOCALE, normalizeLocale } from './localeNegotiation';

/**
 * Formatação sensível a idioma sobre o `Intl` da plataforma — sem `date-fns`, sem tabela de meses e
 * sem padrão escrito à mão. É compartilhado com `functions/`, então nada aqui pode tocar o DOM.
 *
 * Os construtores do `Intl` são caros o bastante para aparecerem num perfil quando uma listagem
 * formata mil células, e por isso ficam memoizados por (idioma + opções). O cache é de módulo e não
 * tem invalidação: um `Intl.DateTimeFormat` de um idioma nunca deixa de ser válido.
 */
const cache = new Map<string, unknown>();

const memo = <T>(key: string, build: () => T): T => {
  const cached = cache.get(key);
  if (cached !== undefined) return cached as T;
  const built = build();
  cache.set(key, built);
  return built;
};

const safeLocale = (locale: LocaleCode): LocaleCode => normalizeLocale(locale) || DEFAULT_LOCALE;

/**
 * Toda entrada de data do sistema atravessa aqui. Aceita `Date`, ISO ou o que já foi convertido de um
 * Timestamp, porque a mesma coleção guarda documentos de épocas diferentes e quem exibe não deveria
 * precisar se defender disso. Valor irreconhecível vira string vazia, nunca "Invalid Date".
 */
const toDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateFor = (
  locale: LocaleCode,
  value: unknown,
  options: Intl.DateTimeFormatOptions = {},
): string => {
  const date = toDate(value);
  if (!date) return '';
  const resolved = safeLocale(locale);
  const formatter = memo(
    `date:${resolved}:${JSON.stringify(options)}`,
    () => new Intl.DateTimeFormat(resolved, options),
  );
  return formatter.format(date);
};

export const formatDateTimeFor = (locale: LocaleCode, value: unknown): string =>
  formatDateFor(locale, value, { dateStyle: 'short', timeStyle: 'short' });

export const formatLongDateFor = (locale: LocaleCode, value: unknown): string =>
  formatDateFor(locale, value, { dateStyle: 'long' });

export const formatNumberFor = (
  locale: LocaleCode,
  value: number | null | undefined,
  options: Intl.NumberFormatOptions = {},
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const resolved = safeLocale(locale);
  const formatter = memo(
    `number:${resolved}:${JSON.stringify(options)}`,
    () => new Intl.NumberFormat(resolved, options),
  );
  return formatter.format(value);
};

/**
 * O espaço fino e o espaço inquebrável que o `Intl` insere entre símbolo e número viram espaço comum:
 * eles quebram comparação de texto, busca na tela e diff de teste, e ninguém os enxerga.
 */
export const formatMoneyFor = (
  locale: LocaleCode,
  value: number | null | undefined,
  currency: string,
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return formatNumberFor(locale, value, { style: 'currency', currency }).replace(
    /[\u00A0\u202F]/g,
    ' ',
  );
};

/**
 * Ordenação de texto pelo idioma. `localeCompare` sem idioma usa o do AMBIENTE DE EXECUÇÃO — no
 * servidor, quase sempre `en-US`, o que já hoje ordena "Ávila" depois de "Zuza" numa listagem
 * brasileira. Passar o idioma explicitamente é a correção.
 */
export const compareTextFor = (locale: LocaleCode, a: string, b: string): number => {
  const resolved = safeLocale(locale);
  const collator = memo(`collator:${resolved}`, () => new Intl.Collator(resolved, { sensitivity: 'base' }));
  return collator.compare(a, b);
};

/**
 * A moeda padrão de um idioma, para quem só tem o idioma em mãos. É um MAPA DE PARTIDA, não uma
 * verdade: o `Intl` não expõe locale → moeda, e um escritório português que fatura em dólar continua
 * podendo passar a moeda explicitamente. Idioma desconhecido cai em USD, junto com o padrão do texto.
 */
const CURRENCY_BY_REGION: Record<string, string> = {
  BR: 'BRL',
  PT: 'EUR',
  US: 'USD',
  GB: 'GBP',
  ES: 'EUR',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  AR: 'ARS',
  CL: 'CLP',
  CO: 'COP',
  MX: 'MXN',
  PY: 'PYG',
  UY: 'UYU',
  AO: 'AOA',
  MZ: 'MZN',
};

const CURRENCY_BY_LANGUAGE: Record<string, string> = {
  pt: 'BRL',
  en: 'USD',
  es: 'EUR',
  de: 'EUR',
  fr: 'EUR',
  it: 'EUR',
};

/**
 * O nome de um idioma, escrito NO PRÓPRIO IDIOMA — "Português (Brasil)", e não "Portuguese (Brazil)".
 * Quem procura a própria língua num seletor a procura como ela se escreve, não como o idioma atual a
 * chama. `Intl.DisplayNames` não existe em runtime muito antigo, e aí o código cru já é a resposta.
 */
export const localeDisplayName = (locale: LocaleCode): string => {
  const resolved = safeLocale(locale);
  try {
    const names = memo(
      `display:${resolved}`,
      () => new Intl.DisplayNames([resolved], { type: 'language' }),
    );
    return names.of(resolved) ?? resolved;
  } catch {
    return resolved;
  }
};

export const currencyForLocale = (locale: LocaleCode): string => {
  const parts = safeLocale(locale).split('-');
  const region = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
  return CURRENCY_BY_REGION[region] ?? CURRENCY_BY_LANGUAGE[parts[0]] ?? 'USD';
};
