// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/predicateMatch.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

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

/**
 * O id de um valor com forma de REGISTRO.
 *
 * A linha chega HIDRATADA: onde o documento guarda o id de uma referência, ela traz o registro
 * apontado inteiro. Comparar esse objeto com o id que o filtro trouxe nunca dava certo — e o
 * relatório não errava o número, ele devolvia vazio, que se lê como "não há nada assim".
 */
const recordId = (value: unknown): string | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || value instanceof Date) {
    return undefined;
  }
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' ? id : undefined;
};

/** Igualdade TOLERANTE: data contra texto ISO, número contra o texto do número, registro pelo id. */
export const looseEquals = (a: unknown, b: unknown): boolean => {
  const aId = recordId(a);
  const bId = recordId(b);
  if (aId !== undefined || bId !== undefined) return (aId ?? a) === (bId ?? b);
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

/**
 * Pertinência entre os dois lados, com qualquer um deles podendo ser LISTA.
 *
 * Um campo de vários não tem um valor: ele tem uma lista — e um filtro pode trazer mais de um
 * escolhido. Igualdade entre lista e valor é uma pergunta que nunca pode ser respondida com sim;
 * o que se pergunta ali é se algum dos que o registro tem está entre os que foram escolhidos.
 */
const anyMatches = (actual: unknown, expected: unknown): boolean => {
  const actuals = Array.isArray(actual) ? actual : [actual];
  const expecteds = Array.isArray(expected) ? expected : [expected];
  return actuals.some((one) => expecteds.some((other) => looseEquals(one, other)));
};

/**
 * "Contém" tem duas leituras, e é o VALOR que decide qual — não o operador.
 *
 * Entre dois TEXTOS é subcadeia, e sem diferenciar maiúscula de minúscula: é o que a condição de
 * automação (`ConditionEvaluator`) já entende por "contém", e a mesma palavra com duas respostas
 * seriam duas verdades sobre o mesmo filtro. Onde há LISTA — de um lado, do outro ou dos dois — a
 * pergunta se repete item a item.
 *
 * A lista era comparada por igualdade EXATA, e era o certo enquanto a única lista alcançável era de
 * ids ou de opções. Um caminho que atravessa uma referência de vários colhe um valor por apontado —
 * e-mail, nome, endereço —, e ali "contém alex" tinha de achar `alexnaldo.santos@gmail.com`: pedia
 * pertinência entre textos inteiros num campo onde ninguém digita o texto inteiro, e o relatório
 * voltava vazio, que se lê como "não há nada assim".
 *
 * O registro apontado continua caindo em `looseEquals`, que o compara pelo id: "contém" sobre uma
 * lista de referências segue sendo pertinência, e nenhum id é comparado por subcadeia.
 */
const containsValue = (actual: unknown, expected: unknown): boolean => {
  if (Array.isArray(actual)) return actual.some((item) => containsValue(item, expected));
  if (Array.isArray(expected)) return expected.some((one) => containsValue(actual, one));
  if (typeof actual === 'string' && typeof expected === 'string') {
    return actual.toLowerCase().includes(expected.toLowerCase());
  }
  return looseEquals(actual, expected);
};

const equals = (actual: unknown, expected: unknown): boolean =>
  Array.isArray(actual) || Array.isArray(expected)
    ? anyMatches(actual, expected)
    : looseEquals(actual, expected);

export const evaluateResolvedPredicate = (
  record: Record<string, unknown>,
  predicate: ResolvedPredicate,
): boolean => {
  const actual = getValueAtPath(record, parsePath(predicate.path));
  const expected = predicate.value;

  switch (predicate.op) {
    case 'eq':
      return equals(actual, expected);
    case 'neq':
      return !equals(actual, expected);
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
      return Array.isArray(expected) && anyMatches(actual, expected);
    case 'contains':
      return containsValue(actual, expected);
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
