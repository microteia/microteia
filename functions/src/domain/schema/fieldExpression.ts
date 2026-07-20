// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/fieldExpression.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/fieldExpression.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { Parser } from 'expr-eval';
import { isEmptyRuleValue, isValidCnpj, isValidCpf, onlyDigits } from './fieldRules';

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
  length: true,
  in: true,
  min: true,
  max: true,
  abs: true,
  ceil: true,
  floor: true,
  round: true,
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

// Nomes deliberadamente iguais aos do catálogo de funções do Workflow, para que o ExpressionEditor
// não acuse "função desconhecida". Apenas funções PURAS (sem WorkflowContext) entram aqui.
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
    Array.isArray(value) ? value.includes(search) : asText(value).includes(asText(search)),
  startsWith: (value, search) => asText(value).startsWith(asText(search)),
  endsWith: (value, search) => asText(value).endsWith(asText(search)),
  indexOf: (value, search) =>
    Array.isArray(value) ? value.indexOf(search) : asText(value).indexOf(asText(search)),
  substring: (value, start, end) =>
    asText(value).substring(Number(start) || 0, end === undefined ? undefined : Number(end)),
  replace: (value, search, replacement) =>
    asText(value).split(asText(search)).join(asText(replacement)),
  today: () => new Date().toISOString().slice(0, 10),
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

export const evaluateFieldBoolean = (
  expr: string | null | undefined,
  ctx: FieldExprContext,
): boolean => {
  if (!expr || !expr.trim()) return false;
  try {
    return Boolean(evaluateFieldExpression(expr, ctx));
  } catch {
    return false;
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
