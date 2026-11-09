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

const DAY_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * O DIA inteiro que um "AAAA-MM-DD" nomeia, como intervalo semiaberto em UTC.
 *
 * Um dia não é um instante, e compará-lo como meia-noite responde errado a metade das perguntas:
 * "criado em ou antes de 2026-10-01" excluiria tudo o que foi criado ao longo daquele dia. Como
 * intervalo, cada operador pergunta o que se lê nele — `lte` é "até o fim do dia", `gt` é "depois
 * do dia". UTC porque é o fuso da âncora de meio-dia com que um campo de data é gravado
 * (`parseDateOnly`): um dia gravado cai sempre dentro do intervalo do mesmo dia.
 */
const dayRange = (value: unknown): { start: number; end: number } | null => {
  if (typeof value !== 'string') return null;
  const match = DAY_ONLY_PATTERN.exec(value.trim());
  if (!match) return null;
  const start = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(start) ? null : { start, end: start + DAY_MS };
};

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

/**
 * O instante de um valor que é DATA — o objeto, ou um texto com forma ISO. A forma é exigida porque
 * `Date.parse` aceita quase tudo (`"1"` é uma data para ele), e um campo de texto qualquer não pode
 * passar a ser comparado como data só porque o filtro trouxe um dia.
 */
const instantOf = (value: unknown): number | undefined => {
  if (value instanceof Date) return value.getTime();
  return typeof value === 'string' && ISO_DATE_PREFIX.test(value.trim()) ? toMillis(value.trim()) : undefined;
};

/**
 * A comparação de um DIA contra um instante, por operador — ou `undefined` quando a pergunta não
 * é essa (o filtro não é um dia puro, ou o valor do registro não é data).
 */
const compareWithDay = (op: QueryOperator, actual: unknown, expected: unknown): boolean | undefined => {
  const range = dayRange(expected);
  if (range === null) return undefined;
  const at = instantOf(actual);
  if (at === undefined) return undefined;
  switch (op) {
    case 'eq': return at >= range.start && at < range.end;
    case 'neq': return at < range.start || at >= range.end;
    case 'lt': return at < range.start;
    case 'lte': return at < range.end;
    case 'gt': return at >= range.end;
    case 'gte': return at >= range.start;
    default: return undefined;
  }
};

/**
 * Ordem entre dois valores, ou `undefined` quando eles não são comparáveis.
 *
 * Um lado DATA faz do outro uma data: o registro chega com `Date` e o filtro chega como texto ISO.
 * Antes o texto ia para `Number()`, virava `NaN` e a comparação era declarada impossível — um
 * `gte` em `createdAt` voltava vazio, que se lê como "não há registro assim".
 */
export const compareValues = (a: unknown, b: unknown): number | undefined => {
  if (a instanceof Date || b instanceof Date) {
    const ad = typeof a === 'number' ? a : instantOf(a);
    const bd = typeof b === 'number' ? b : instantOf(b);
    return ad === undefined || bd === undefined ? undefined : ad - bd;
  }
  const am = a;
  const bm = b;
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

/**
 * "Começa com", na mesma régua do "contém": entre textos, sem diferenciar maiúscula de minúscula; onde
 * há lista, item a item. Fora de texto não há prefixo a perguntar, e a resposta é não — ao contrário
 * do "contém", nenhum registro apontado começa com coisa alguma.
 *
 * Mora aqui, e não em quem a usa, para que o filtro de opções de um campo e qualquer leitor futuro
 * deem a mesma resposta sobre o mesmo prefixo.
 */
export const startsWithValue = (actual: unknown, expected: unknown): boolean => {
  if (Array.isArray(actual)) return actual.some((item) => startsWithValue(item, expected));
  if (Array.isArray(expected)) return expected.some((one) => startsWithValue(actual, one));
  return typeof actual === 'string' && typeof expected === 'string'
    && actual.toLowerCase().startsWith(expected.toLowerCase());
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

  const asDay = Array.isArray(actual) ? undefined : compareWithDay(predicate.op, actual, expected);
  if (asDay !== undefined) return asDay;

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
