import { onlyDigits } from '../domain/schema/fieldRules';
import { ambientLocale } from '../domain/schema/i18n/localeGate';
import { currencyForLocale, formatDateFor, formatMoneyFor } from '../domain/schema/i18n/localeFormat';

export const onlyNumbers = onlyDigits;

/**
 * Fachada de apresentação da formatação. As assinaturas NÃO mudam, e isso é requisito, não estilo:
 * este módulo viaja até as extensões como `@microteia/format` (ver `hostApi.ts`), e acrescentar um
 * parâmetro de idioma quebraria toda extensão instalada. O idioma chega pelo contexto de módulo que
 * o `LocaleProvider` empurra — mesmo mecanismo de `recordRulesGate`.
 *
 * Enquanto ninguém tiver escolhido idioma, `ambientLocale()` devolve o de sempre e nada muda de
 * aparência. Ver `LEGACY_LOCALE`.
 */

/**
 * Formata um valor como moeda no idioma corrente.
 *
 * O nome carrega "BRL" por história, não por comportamento: mantê-lo é o que impede a quebra das
 * extensões que já o importam. `formatCurrency` é o nome certo para código novo.
 */
export const formatCurrencyBRL = (value: number | null | undefined): string =>
  formatCurrency(value);

export const formatCurrency = (value: number | null | undefined, currency?: string): string => {
  const locale = ambientLocale();
  return formatMoneyFor(locale, value, currency ?? currencyForLocale(locale));
};

/**
 * Converte os dígitos digitados por último em um input de moeda (interpretados
 * como centavos, da direita para a esquerda) no valor numérico correspondente.
 */
export const parseCurrencyDigits = (raw: string): number | null => {
  const digits = onlyDigits(raw);
  if (digits.length === 0) return null;
  return Number(digits) / 100;
};

/**
 * Uma data no formato que o escritório lê. Aceita `Date`, string ISO ou Timestamp já convertido —
 * a mesma coleção tem documentos de épocas diferentes, e quem exibe não deve precisar se defender
 * disso. Valor irreconhecível vira string vazia, nunca "Invalid Date".
 */
export const formatDate = (value: unknown): string => formatDateFor(ambientLocale(), value);

/**
 * Converte um Date para o formato aaaa-mm-dd de um <input type="date">, usando os componentes de
 * data LOCAIS (nunca toISOString, que desloca o dia em fusos com offset negativo, ex: horário de
 * Brasília à noite). Não passa pelo idioma de propósito: `aaaa-mm-dd` é o formato do CONTROLE HTML,
 * igual em toda língua — traduzi-lo quebraria o campo.
 */
export const toDateInputValue = (d: Date | null | undefined): string => {
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
