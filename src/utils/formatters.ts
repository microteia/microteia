import { onlyDigits } from '../domain/schema/fieldRules';
import { ambientLocale } from '../domain/schema/i18n/localeGate';
import { currencyForLocale, formatDateFor, formatMoneyFor } from '../domain/schema/i18n/localeFormat';
import { dayInTimeZone } from '../domain/schema/i18n/timeZone';
import { ambientInstant, ambientTimeZone } from '../domain/schema/clockGate';

export const onlyNumbers = onlyDigits;

/**
 * Fachada de apresentação da formatação. As assinaturas NÃO mudam, e isso é requisito, não estilo:
 * este módulo viaja até as extensões como `@microteia/format` (ver `hostApi.ts`), e acrescentar um
 * parâmetro de idioma quebraria toda extensão instalada. O idioma chega pelo contexto de módulo que
 * o `LocaleProvider` empurra — mesmo mecanismo de `recordRulesGate`.
 *
 * Antes de o provedor empurrar o primeiro idioma, `ambientLocale()` devolve o idioma-fonte. Ele não
 * fica preso a um idioma fixo: o provedor negocia com o do navegador quando ninguém escolheu nada.
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

const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const isTimestampLike = (value: unknown): value is { toDate: () => Date } =>
  !!value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function';

/**
 * O DIA DO ESCRITÓRIO (`YYYY-MM-DD`) — a mesma resposta de `today()` numa expressão, no mesmo fuso
 * (`i18n.timezone`). É o lado direito de "já venceu?" numa view: `dayOf(r.dueDate) < today()`.
 */
export const today = (): string => dayInTimeZone(ambientInstant(), ambientTimeZone());

/**
 * O DIA (`YYYY-MM-DD`) de um valor de data, no relógio do escritório — o texto que se compara com
 * `today()` e entre si, na ordem certa. Aceita o que uma view recebe (`Date`), o Timestamp do Firestore
 * e texto; um dia já em texto passa intacto. Irreconhecível vira texto vazio.
 *
 * Existe porque cada autor escrevia a sua: quatro cópias numa instalação só, e a primeira escrita
 * comparou o Timestamp como texto — vazio, que é "menor que tudo" e esconde o registro sem erro.
 */
export const dayOf = (value: unknown): string => {
  if (typeof value === 'string' && DAY_ONLY.test(value.trim())) return value.trim();
  const date = value instanceof Date
    ? value
    : isTimestampLike(value)
      ? value.toDate()
      : typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')
        ? new Date(value)
        : null;
  return date && !Number.isNaN(date.getTime()) ? dayInTimeZone(date, ambientTimeZone()) : '';
};

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
