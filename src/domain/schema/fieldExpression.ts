// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/fieldExpression.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { Parser } from 'expr-eval';
import { isEmptyRuleValue, isValidCnpj, isValidCpf, onlyDigits } from './fieldRulePresets';
import { ambientLocale } from './i18n/localeGate';
import { currencyForLocale, formatMoneyFor } from './i18n/localeFormat';

export interface FieldExprContext {
  value: unknown;
  data: Record<string, unknown>;
}

const EXPRESSION_OPERATORS = {
  add: true,
  comparison: true,
  concatenate: true,
  conditional: true,
  divide: true,
  factorial: true,
  logical: true,
  multiply: true,
  power: true,
  remainder: true,
  subtract: true,
  // Desligado junto com `round`: como operador built-in, `length(null)` devolvia 4 (o expr-eval vira
  // `null` em "null" e conta as letras). Como função, campo vazio conta 0.
  length: false,
  in: true,
  min: true,
  max: true,
  abs: true,
  ceil: true,
  floor: true,
  // Desligado de propósito: `round` precisa ser FUNÇÃO para aceitar as casas decimais que o catálogo
  // anuncia (`round(3.14159, 2)`). Como operador unário do expr-eval ele nem parseava o 2º argumento.
  round: false,
  sqrt: true,
  assignment: false,
  fndef: false,
} as const;

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UNSAFE_PATH_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const DAY_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isTimestampLike = (value: unknown): value is { toDate: () => Date } =>
  !!value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function';

/**
 * Uma data chega aqui em qualquer das formas que o registro conhece: `Date`, `Timestamp` do
 * Firestore, milissegundos ou texto. O texto de DIA (`YYYY-MM-DD`) — o que `today()` devolve e o que
 * um campo de data guarda — vira meia-noite LOCAL, e não UTC: assim o dia que entra é o dia que sai,
 * sem o deslocamento de um fuso negativo comer a véspera.
 */
const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (isTimestampLike(value)) return toDate(value.toDate());
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value) : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (DAY_ONLY_PATTERN.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isDayOnly = (value: unknown): boolean =>
  typeof value === 'string' && DAY_ONLY_PATTERN.test(value.trim());

const padded = (value: number): string => String(value).padStart(2, '0');

const asDayText = (date: Date): string =>
  `${date.getFullYear()}-${padded(date.getMonth() + 1)}-${padded(date.getDate())}`;

const asNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  const parsed = Number(asText(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const DATE_DIFF_DIVISORS: Record<string, number> = {
  days: 86400000,
  dias: 86400000,
  hours: 3600000,
  horas: 3600000,
  minutes: 60000,
  minutos: 60000,
  seconds: 1000,
  segundos: 1000,
};

/**
 * APELIDOS herdados de `formatMoney`, de quando o segundo argumento era uma união de três valores.
 * Continuam valendo porque há automação escrita com eles gravada em escritório — `eu` em particular
 * nem é um idioma, é o rótulo que se deu ao euro. Qualquer outro valor é lido como idioma BCP-47
 * comum, e a moeda sai de `currencyForLocale`.
 */
const MONEY_LOCALES: Record<string, { locale: string; currency: string }> = {
  'pt-br': { locale: 'pt-BR', currency: 'BRL' },
  'en-us': { locale: 'en-US', currency: 'USD' },
  'eu': { locale: 'de-DE', currency: 'EUR' },
};

const numbersOf = (value: unknown): number[] =>
  Array.isArray(value) ? value.map(asNumber).filter((item) => Number.isFinite(item)) : [];

const splitPath = (path: unknown): string[] =>
  asText(path)
    .split('.')
    .map((key) => key.trim())
    .filter((key) => key !== '');

const resolvePath = (item: unknown, keys: string[]): unknown =>
  keys.reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined;
    if (UNSAFE_PATH_KEYS.has(key)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, item);

/**
 * No FRONT, um campo de referência pode chegar hidratado — o registro inteiro no lugar do id (ver
 * `referenceScope.ts`). Casar também pelo `id` mantém `contains(produtos, '<id>')` funcionando nos
 * dois formatos, em vez de silenciosamente devolver false quando o item é um objeto.
 */
const matchesItem = (item: unknown, search: unknown): boolean => {
  if (item === search) return true;
  if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
    return (item as Record<string, unknown>).id === search;
  }
  return false;
};

// Nomes deliberadamente iguais aos do catálogo de funções do Workflow, para que o ExpressionEditor
// não acuse "função desconhecida". Apenas funções PURAS (sem WorkflowContext) entram aqui.
//
// A COBERTURA é o contrato: o editor valida a expressão contra o catálogo do Workflow, que vem do
// servidor. Uma função que exista lá e falte aqui é aprovada na tela e estoura na hora de avaliar —
// foi o que aconteceu com `addDays`. Quem acrescentar função ao catálogo do Workflow acrescenta o
// par PURO aqui, e o teste de cobertura em `fieldExpression.test.ts` cobra isso.
//
// Fora da lista, de propósito: `getVar` (lê o `WorkflowContext`, que não existe no registro) e todo
// nome que o `expr-eval` reserva como OPERADOR — `and`/`or` (erro de sintaxe como função) e
// `not`/`abs`/`ceil`/`floor` (o operador unário resolve antes, deixando órfã qualquer função
// registrada com esse nome). Todos funcionam pelo built-in, na forma que o operador aceita.
const FIELD_EXPRESSION_FUNCTIONS: Record<string, (...args: unknown[]) => unknown> = {
  if: (condition, whenTrue, whenFalse) => (condition ? whenTrue : whenFalse),
  concat: (...args) => args.map(asText).join(''),
  lower: (value) => asText(value).toLowerCase(),
  upper: (value) => asText(value).toUpperCase(),
  trim: (value) => asText(value).trim(),
  length: (value) => (Array.isArray(value) ? value.length : asText(value).length),
  isEmpty: (value) => isEmptyRuleValue(value),
  isNull: (value) => value === null || value === undefined,
  isNotNull: (value) => value !== null && value !== undefined,
  coalesce: (...args) => args.find((arg) => !isEmptyRuleValue(arg)) ?? null,
  onlyNumber: (value) => onlyDigits(asText(value)),
  isCPF: (value) => isValidCpf(asText(value)),
  isCNPJ: (value) => isValidCnpj(asText(value)),
  isEmail: (value) => EMAIL_PATTERN.test(asText(value)),
  contains: (value, search) =>
    Array.isArray(value) ? value.some((item) => matchesItem(item, search)) : asText(value).includes(asText(search)),
  startsWith: (value, search) => asText(value).startsWith(asText(search)),
  endsWith: (value, search) => asText(value).endsWith(asText(search)),
  indexOf: (value, search) =>
    Array.isArray(value)
      ? value.findIndex((item) => matchesItem(item, search))
      : asText(value).indexOf(asText(search)),
  substring: (value, start, end) =>
    asText(value).substring(Number(start) || 0, end === undefined ? undefined : Number(end)),
  replace: (value, search, replacement) =>
    asText(value).split(asText(search)).join(asText(replacement)),
  split: (value, separator) => asText(value).split(asText(separator)),
  join: (array, separator) =>
    (Array.isArray(array) ? array : []).map(asText).join(separator === undefined ? '' : asText(separator)),
  interpolate: (template, ...values) => {
    const named =
      values.length === 1 && values[0] !== null && typeof values[0] === 'object' && !Array.isArray(values[0])
        ? (values[0] as Record<string, unknown>)
        : null;
    return asText(template).replace(/\{([\w.]+)\}/g, (_match, token: string) => {
      const found = /^\d+$/.test(token) ? values[Number(token)] : resolvePath(named, splitPath(token));
      if (found === null || found === undefined) return '';
      return typeof found === 'object' ? JSON.stringify(found) : String(found);
    });
  },
  formatMoney: (value, locale) => {
    const amount = asNumber(value);
    if (!Number.isFinite(amount)) return '';
    if (locale === undefined) {
      const ambient = ambientLocale();
      return formatMoneyFor(ambient, amount, currencyForLocale(ambient));
    }
    const requested = asText(locale);
    const alias = MONEY_LOCALES[requested.toLowerCase()];
    if (alias) return formatMoneyFor(alias.locale, amount, alias.currency);
    return formatMoneyFor(requested, amount, currencyForLocale(requested));
  },
  formatCPF: (value) => {
    const clean = onlyDigits(asText(value));
    return clean.length === 11 ? clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : asText(value);
  },
  formatCNPJ: (value) => {
    const clean = onlyDigits(asText(value));
    return clean.length === 14
      ? clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
      : asText(value);
  },
  round: (value, decimals) => {
    const amount = asNumber(value);
    if (!Number.isFinite(amount)) return null;
    const places = decimals === undefined ? 0 : asNumber(decimals);
    const multiplier = Math.pow(10, Number.isFinite(places) ? places : 0);
    return Math.round(amount * multiplier) / multiplier;
  },
  sum: (array) => numbersOf(array).reduce((total, item) => total + item, 0),
  avg: (array) => {
    const numbers = numbersOf(array);
    return numbers.length === 0 ? 0 : numbers.reduce((total, item) => total + item, 0) / numbers.length;
  },
  first: (array) => (Array.isArray(array) && array.length > 0 ? array[0] : null),
  last: (array) => (Array.isArray(array) && array.length > 0 ? array[array.length - 1] : null),
  delete: (key, target) => {
    if (target === null || typeof target !== 'object' || Array.isArray(target)) return target;
    const clone = { ...(target as Record<string, unknown>) };
    delete clone[asText(key)];
    return clone;
  },
  today: () => new Date().toISOString().slice(0, 10),
  now: () => new Date().toISOString(),
  /**
   * O RESULTADO tem a forma da ENTRADA: dia entra, dia sai (`YYYY-MM-DD`, que é o que um campo de
   * data guarda e o que `today()` devolve); instante entra, instante sai. Assim
   * `addDays(today(), 15)` cai direto num campo de data, sem conversão pelo caminho.
   */
  addDays: (value, days) => {
    const date = toDate(value);
    const amount = asNumber(days);
    if (!date || !Number.isFinite(amount)) return null;
    const shifted = new Date(date);
    shifted.setDate(shifted.getDate() + amount);
    return isDayOnly(value) ? asDayText(shifted) : shifted.toISOString();
  },
  formatDate: (value, format) => {
    const date = toDate(value);
    if (!date) return '';
    return asText(format)
      .replace('YYYY', String(date.getFullYear()))
      .replace('MM', padded(date.getMonth() + 1))
      .replace('DD', padded(date.getDate()))
      .replace('HH', padded(date.getHours()))
      .replace('mm', padded(date.getMinutes()))
      .replace('ss', padded(date.getSeconds()));
  },
  dateDiff: (first, second, unit) => {
    const from = toDate(first);
    const to = toDate(second);
    if (!from || !to) return null;
    const divisor = DATE_DIFF_DIVISORS[asText(unit === undefined ? 'days' : unit).toLowerCase()];
    if (!divisor) return null;
    return Math.floor((from.getTime() - to.getTime()) / divisor);
  },
  dayOfWeek: (value) => toDate(value)?.getDay() ?? null,
  isWeekend: (value) => {
    const date = toDate(value);
    if (!date) return false;
    return date.getDay() === 0 || date.getDay() === 6;
  },
  year: (value) => toDate(value)?.getFullYear() ?? null,
  month: (value) => {
    const date = toDate(value);
    return date ? date.getMonth() + 1 : null;
  },
  day: (value) => toDate(value)?.getDate() ?? null,
  // `expr-eval` tem literal de array mas não de objeto — daí a forma por pares, mesma solução já
  // adotada no status compacto das Actions. object('preco', 10) → { preco: 10 }.
  object: (...args) => {
    const result: Record<string, unknown> = {};
    for (let index = 0; index + 1 < args.length; index += 2) {
      const key = asText(args[index]).trim();
      if (key !== '' && !UNSAFE_PATH_KEYS.has(key)) result[key] = args[index + 1];
    }
    return result;
  },
  map: (array, path, compact) => {
    if (!Array.isArray(array)) return [];
    const keys = splitPath(path);
    const result = keys.length === 0 ? [...array] : array.map((item) => resolvePath(item, keys));
    return compact ? result.filter((item) => !isEmptyRuleValue(item)) : result;
  },
};

const buildParser = (): Parser => {
  const parser = new Parser({ allowMemberAccess: true, operators: EXPRESSION_OPERATORS });
  for (const [name, fn] of Object.entries(FIELD_EXPRESSION_FUNCTIONS)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- expr-eval não tipa parser.functions
    (parser.functions as any)[name] = fn;
  }
  return parser;
};

const fieldParser = buildParser();

/** O catálogo desta ponta, para o teste que o confronta com o catálogo do Workflow. */
export const FIELD_EXPRESSION_FUNCTION_NAMES: readonly string[] =
  Object.keys(FIELD_EXPRESSION_FUNCTIONS);

const buildScope = (ctx: FieldExprContext): Record<string, unknown> => ({
  null: null,
  true: true,
  false: false,
  ...ctx.data,
  value: ctx.value,
  self: ctx.value,
});

export const evaluateFieldExpression = (expr: string, ctx: FieldExprContext): unknown =>
  fieldParser.parse(expr).evaluate(buildScope(ctx) as never);

const SCOPE_RESERVED_VARIABLES = new Set(['null', 'true', 'false', 'value', 'self']);

export const extractFieldExpressionDependencies = (
  expr: string | null | undefined,
): string[] => {
  if (!expr || !expr.trim()) return [];
  try {
    return fieldParser
      .parse(expr)
      .variables({ withMembers: false })
      .filter((name) => !SCOPE_RESERVED_VARIABLES.has(name));
  } catch {
    return [];
  }
};

/**
 * `fallback` é o resultado quando a expressão está ausente ou estoura. Os slots de tela (`hiddenWhen`,
 * `disabledWhen`) querem `false` — na dúvida, mostra o campo. Já a validação de um preset quer `true`:
 * um preset quebrado não pode reprovar um valor legítimo.
 */
export const evaluateFieldBoolean = (
  expr: string | null | undefined,
  ctx: FieldExprContext,
  fallback = false,
): boolean => {
  if (!expr || !expr.trim()) return fallback;
  try {
    return Boolean(evaluateFieldExpression(expr, ctx));
  } catch {
    return fallback;
  }
};

export const evaluateFieldValidation = (
  expr: string | null | undefined,
  ctx: FieldExprContext,
): string | null => {
  if (!expr || !expr.trim()) return null;
  try {
    const result = evaluateFieldExpression(expr, ctx);
    if (typeof result === 'string') {
      const trimmed = result.trim();
      return trimmed === '' ? null : trimmed;
    }
    if (result === null || result === undefined || result === false) return null;
    return 'Valor inválido';
  } catch {
    return null;
  }
};
