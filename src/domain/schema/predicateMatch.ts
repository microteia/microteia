// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/predicateMatch.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { getValueAtPath, parsePath } from './pathResolver';
import type { QueryOperator } from './querySpec';

/**
 * Um predicado cujo valor JÁ foi resolvido — o `InputMapping` virou o dado que ele designava.
 *
 * A resolução fica com quem tem contexto (a callable, o motor de workflow); a COMPARAÇÃO fica aqui,
 * pura, porque ela precisa dar o mesmo resultado nos dois lados. Enquanto o avaliador morava dentro
 * do executor de workflow, o relatório só tinha duas saídas: copiá-lo — e divergir na primeira
 * operação nova, aceitando o que o fluxo recusa — ou não filtrar como ele.
 */
export interface ResolvedPredicate {
  path: string;
  op: QueryOperator;
  value?: unknown;
}

const toMillis = (value: unknown): number | undefined => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

/** Igualdade TOLERANTE: data contra texto ISO, número contra o texto do número. */
export const looseEquals = (a: unknown, b: unknown): boolean => {
  if (a instanceof Date || b instanceof Date) {
    const am = toMillis(a);
    const bm = toMillis(b);
    return am !== undefined && am === bm;
  }
  if (typeof a === 'number' && typeof b === 'string') return a === Number(b);
  if (typeof a === 'string' && typeof b === 'number') return Number(a) === b;
  return a === b;
};

/** Ordem entre dois valores, ou `undefined` quando eles não são comparáveis. */
export const compareValues = (a: unknown, b: unknown): number | undefined => {
  const am = a instanceof Date ? a.getTime() : a;
  const bm = b instanceof Date ? b.getTime() : b;
  if (typeof am === 'number' || typeof bm === 'number') {
    const an = typeof am === 'number' ? am : Number(am);
    const bn = typeof bm === 'number' ? bm : Number(bm);
    if (Number.isNaN(an) || Number.isNaN(bn)) return undefined;
    return an - bn;
  }
  if (typeof am === 'string' && typeof bm === 'string') return am.localeCompare(bm);
  return undefined;
};

export const evaluateResolvedPredicate = (
  record: Record<string, unknown>,
  predicate: ResolvedPredicate,
): boolean => {
  const actual = getValueAtPath(record, parsePath(predicate.path));
  const expected = predicate.value;

  switch (predicate.op) {
    case 'eq':
      return looseEquals(actual, expected);
    case 'neq':
      return !looseEquals(actual, expected);
    case 'lt': {
      const c = compareValues(actual, expected);
      return c !== undefined && c < 0;
    }
    case 'lte': {
      const c = compareValues(actual, expected);
      return c !== undefined && c <= 0;
    }
    case 'gt': {
      const c = compareValues(actual, expected);
      return c !== undefined && c > 0;
    }
    case 'gte': {
      const c = compareValues(actual, expected);
      return c !== undefined && c >= 0;
    }
    case 'in':
      return Array.isArray(expected) && expected.some((item) => looseEquals(actual, item));
    case 'contains':
      if (Array.isArray(actual)) return actual.some((item) => looseEquals(item, expected));
      if (typeof actual === 'string' && typeof expected === 'string') return actual.includes(expected);
      return false;
    case 'exists':
      return actual !== undefined && actual !== null;
    default:
      return false;
  }
};

/** Todos os predicados precisam passar. Lista vazia aceita tudo. */
export const matchesResolvedPredicates = (
  record: Record<string, unknown>,
  predicates: ResolvedPredicate[],
): boolean => predicates.every((predicate) => evaluateResolvedPredicate(record, predicate));
