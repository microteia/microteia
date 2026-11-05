import type { FieldDefinition } from '../entities/entitySchemas';
import { RECORD_WINDOW_DEFAULT } from '../repositories/IRecordRepository';
import { FILTER_RANGE_TO_SUFFIX, toDateFieldInput } from './customFieldValues';

/**
 * A partir de qual `KERNEL_VERSION` a extensão tem os registros além da janela: `paginate` no
 * `useEntityList`, `useRecordsByIds`, `useRecordCounts` e o `recordMatches` no ⌘K e na menção. É o que
 * o guia de autoria cita.
 */
export const SERVER_RECORDS_API_SINCE_KERNEL = '2.97.0';

/**
 * A partir de qual `KERNEL_VERSION` a condição de DIA (`{ field, from, to }`) vale no `useRecordCounts`, e
 * o `useRecordsWhere` existe. É o que o guia de autoria cita.
 */
export const RECORD_CONDITIONS_SINCE_KERNEL = '2.98.0';

/** A partir de qual `KERNEL_VERSION` existe o `useRecordSums` — a soma no servidor. */
export const RECORD_SUMS_SINCE_KERNEL = '2.99.0';

/** O teto do `useRecordsWhere`: é uma consulta de cartão, não uma listagem — esta tem `paginate`. */
export const RECORDS_WHERE_MAX = RECORD_WINDOW_DEFAULT;

/** Registros por página da listagem: a rolagem infinita pede mais deste tanto a cada vez. */
export const RECORD_LIST_PAGE_SIZE = 50;

/**
 * O que uma consulta COM FILTRO traz de uma vez. A consulta filtrada não ordena por data no servidor
 * (ordenar junto com uma igualdade pediria índice composto, que uma coleção criada em runtime não
 * pode declarar), e por isso a janela é grande: a ordem é refeita em memória sobre ela.
 */
export const RECORD_LIST_FILTER_WINDOW = RECORD_WINDOW_DEFAULT;

/** O teto do `in` e do `array-contains-any` do Firestore. */
const MAX_DISJUNCTION_VALUES = 30;

export type RecordQueryOp = '==' | 'in' | 'array-contains' | 'array-contains-any';

export interface RecordQueryClause {
  field: string;
  op: RecordQueryOp;
  value: unknown;
}

/**
 * Uma consulta de listagem que cabe nos índices de campo ÚNICO. Três formas, e só elas:
 *
 * - sem cláusula, ordenada por `createdAt` — a listagem sem filtro, paginada;
 * - com igualdades, sem ordenação — a listagem filtrada e a aba de filhos; as igualdades sem ordem são
 *   servidas juntando índices de campo único;
 * - com intervalo de data e ordenada pelo MESMO campo — o filtro só de data, paginado.
 *
 * Qualquer combinação além destas pediria índice composto.
 */
export interface RecordQuerySpec {
  collection: string;
  limit: number;
  /** Disjunção: o vínculo com o pai, por qualquer dos campos que apontam para ele. */
  anyOf: RecordQueryClause[];
  /** Conjunção, somada à disjunção: o filtro que a pessoa escolheu e que o servidor sabe fazer. */
  allOf: RecordQueryClause[];
  range: RecordDayRange | null;
  orderBy: { field: string; dir: 'asc' | 'desc' } | null;
}

/** Pontas em `AAAA-MM-DD`, inclusivas — a mesma forma do filtro "a partir de / até" da listagem. */
export interface RecordDayRange {
  field: string;
  from: string | null;
  to: string | null;
}

/** O que uma contagem pergunta: as igualdades todas juntas e, no máximo, um intervalo de dia. */
export interface RecordCountSpec {
  collection: string;
  allOf: RecordQueryClause[];
  range: RecordDayRange | null;
}

export interface RecordListFilterInput {
  collection: string;
  fields: readonly FieldDefinition[];
  tokenMap: Record<string, string[]>;
  pageLimit: number;
  /** A aba do pai: os filhos são os que apontam para ele por um destes campos. */
  parent: { fieldKeys: readonly string[]; recordId: string } | null;
  /** A tela declara a própria ordem (uma agenda): paginar por data de cadastro mostraria a página errada. */
  hasDeclaredOrder: boolean;
  /**
   * A lista aceita ser PAGINADA — e, com isso, ter `records` reduzido ao que já foi trazido e ao que o
   * filtro do servidor deixou passar. A listagem do kernel aceita; a de extensão só quando pede
   * (`EntityListOptions.paginate`), porque o contrato dela sempre foi `records` como a coleção inteira:
   * uma extensão que conta pendentes ou acha um registro por id ali passaria a contar e achar errado.
   */
  paginate: boolean;
}

const TAG_TOKEN = 'tag';
const SEARCH_TOKEN = 'search';
const TAG_FIELD = 'tagIds';

const valuesOf = (tokenMap: Record<string, string[]>, key: string): string[] =>
  (tokenMap[key] ?? []).filter((value) => value !== '');

/** A igualdade que o servidor pode fazer por este filtro — ou `null` quando ele só vale em memória. */
const serverClauseOf = (field: FieldDefinition, values: string[]): RecordQueryClause | null => {
  if (values.length === 0 || values.length > MAX_DISJUNCTION_VALUES) return null;
  if (field.type === 'select' || field.type === 'reference') {
    if (field.multi) return { field: field.key, op: 'array-contains-any', value: values };
    return values.length === 1 ? { field: field.key, op: '==', value: values[0] } : { field: field.key, op: 'in', value: values };
  }
  // Marcado é `true` gravado; desmarcado pode ser `false` ou campo AUSENTE, que a igualdade não acha.
  if (field.type === 'checkbox' && values[0] === 'true') return { field: field.key, op: '==', value: true };
  return null;
};

const isArrayOp = (op: RecordQueryOp): boolean => op === 'array-contains' || op === 'array-contains-any';

/** Quantas disjunções a cláusula vale para o Firestore: `in` e `array-contains-any` contam cada valor. */
const disjunctionsOf = (clause: RecordQueryClause): number =>
  Array.isArray(clause.value) ? clause.value.length : 1;

/** O filtro escolhido que o servidor sabe fazer, o primeiro deles: as etiquetas, e depois os campos na ordem da tela. */
const firstServerClause = (fields: readonly FieldDefinition[], tokenMap: Record<string, string[]>): RecordQueryClause | null => {
  const tags = valuesOf(tokenMap, TAG_TOKEN);
  if (tags.length > 0 && tags.length <= MAX_DISJUNCTION_VALUES) return { field: TAG_FIELD, op: 'array-contains-any', value: tags };
  for (const field of fields) {
    if (!field.filterable) continue;
    const clause = serverClauseOf(field, valuesOf(tokenMap, field.key));
    if (clause) return clause;
  }
  return null;
};

/**
 * Qual consulta a listagem faz. `null` quando ela deve ficar na janela da coleção, como sempre foi:
 * a lista que não pagina e a tela que declara a própria ordem (paginar por cadastro mostraria a página
 * errada de uma agenda). A aba de filhos consulta só os filhos do pai em qualquer caso: continua sendo
 * a lista inteira daquele pai, agora sem o teto da janela da coleção inteira.
 *
 * Com filtro, UMA igualdade vai ao servidor e o resto é conferido em memória sobre o que volta — a
 * consulta com várias igualdades e ordenação pediria índice composto. O filtro só de data é o único
 * que pagina pelo próprio campo. Um filtro que o servidor não sabe fazer (texto, presença, desmarcado)
 * e nenhum que saiba: a janela grande, filtrada em memória.
 */
export const planRecordListQuery = (input: RecordListFilterInput): RecordQuerySpec | null => {
  const { collection, fields, tokenMap, pageLimit, parent, hasDeclaredOrder, paginate } = input;

  const windowed = (anyOf: RecordQueryClause[], allOf: RecordQueryClause[]): RecordQuerySpec => ({
    collection,
    // Sem paginar, a janela grande e fixa — o contrato de sempre. Paginando, ela cresce com a rolagem.
    limit: paginate ? Math.max(pageLimit, RECORD_LIST_FILTER_WINDOW) : RECORD_LIST_FILTER_WINDOW,
    anyOf,
    allOf,
    range: null,
    orderBy: null,
  });

  const active = Object.entries(tokenMap).filter(([key, values]) => key !== SEARCH_TOKEN && values.some((value) => value !== ''));
  const userClause = paginate && active.length > 0 ? firstServerClause(fields, tokenMap) : null;

  /**
   * A aba do pai é a listagem com um filtro fixo e invisível: o vínculo. Ela consulta só os filhos em
   * qualquer caso, e, paginando, leva junto o filtro que a pessoa escolheu — quando o Firestore aceita a
   * combinação. Ele recusa `array-contains` com `array-contains-any` na mesma consulta, e limita a 30 o
   * produto das disjunções: fora disso, o filtro fica em memória sobre os filhos trazidos.
   */
  if (parent && parent.fieldKeys.length > 0) {
    const anyOf = parent.fieldKeys.map((key): RecordQueryClause => (
      fields.find((candidate) => candidate.key === key)?.multi
        ? { field: key, op: 'array-contains', value: parent.recordId }
        : { field: key, op: '==', value: parent.recordId }
    ));
    const combinable = !!userClause
      && !(isArrayOp(userClause.op) && anyOf.some((clause) => isArrayOp(clause.op)))
      && anyOf.length * disjunctionsOf(userClause) <= MAX_DISJUNCTION_VALUES;
    return windowed(anyOf, combinable && userClause ? [userClause] : []);
  }

  if (hasDeclaredOrder || !paginate) return null;

  if (active.length === 0) {
    return { collection, limit: pageLimit, anyOf: [], allOf: [], range: null, orderBy: { field: 'createdAt', dir: 'desc' } };
  }

  if (userClause) return windowed([], [userClause]);

  const dateFilters = fields.filter((field) => field.filterable && field.type === 'date'
    && (valuesOf(tokenMap, field.key).length > 0 || valuesOf(tokenMap, `${field.key}${FILTER_RANGE_TO_SUFFIX}`).length > 0));
  const onlyDates = active.every(([key]) => dateFilters.some((field) => key === field.key || key === `${field.key}${FILTER_RANGE_TO_SUFFIX}`));
  if (dateFilters.length === 1 && onlyDates) {
    const [field] = dateFilters;
    return {
      collection,
      limit: pageLimit,
      anyOf: [],
      allOf: [],
      range: {
        field: field.key,
        from: valuesOf(tokenMap, field.key)[0] ?? null,
        to: valuesOf(tokenMap, `${field.key}${FILTER_RANGE_TO_SUFFIX}`)[0] ?? null,
      },
      orderBy: { field: field.key, dir: 'desc' },
    };
  }

  return { collection, limit: Math.max(pageLimit, RECORD_LIST_FILTER_WINDOW), anyOf: [], allOf: [], range: null, orderBy: { field: 'createdAt', dir: 'desc' } };
};

/** A consulta trouxe tudo o que pediu: pode haver mais para trazer. */
export const recordQueryHasMore = (spec: RecordQuerySpec, delivered: number): boolean => delivered >= spec.limit;

/**
 * Uma condição como a EXTENSÃO a escreve (`useRecordCounts`, `useRecordsWhere`): uma igualdade — `op`
 * é `==` por padrão — ou um intervalo de dia, com uma ponta ou as duas.
 */
export type RecordCondition =
  | { field: string; op?: Extract<RecordQueryOp, '==' | 'in' | 'array-contains'>; value: unknown }
  | { field: string; from?: string | null; to?: string | null };

const DAY_TEXT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * As condições da extensão na forma da consulta — ou `null` quando ela não cabe numa: dois intervalos
 * (o plano tem um só, e cada campo de intervalo a mais é mais um índice composto a declarar), um dia
 * que não é `AAAA-MM-DD`, ou um intervalo sem ponta nenhuma, que quase sempre é uma variável que veio
 * vazia e contaria tudo sem ninguém perceber.
 */
export const recordConditionsQuery = (
  conditions: readonly RecordCondition[],
): { allOf: RecordQueryClause[]; range: RecordDayRange | null } | null => {
  const allOf: RecordQueryClause[] = [];
  let range: RecordDayRange | null = null;
  for (const condition of conditions) {
    if ('value' in condition) {
      allOf.push({ field: condition.field, op: condition.op ?? '==', value: condition.value });
      continue;
    }
    const from = condition.from || null;
    const to = condition.to || null;
    if (range || (!from && !to)) return null;
    if ((from && !DAY_TEXT.test(from)) || (to && !DAY_TEXT.test(to))) return null;
    range = { field: condition.field, from, to };
  }
  return { allOf, range };
};

const clauseMatches = (stored: unknown, clause: RecordQueryClause): boolean => {
  const values = Array.isArray(clause.value) ? clause.value : [clause.value];
  switch (clause.op) {
    case '==': return stored === clause.value;
    case 'in': return values.includes(stored);
    case 'array-contains': return Array.isArray(stored) && stored.includes(clause.value);
    case 'array-contains-any': return Array.isArray(stored) && stored.some((item) => values.includes(item));
  }
};

/**
 * O registro atende à consulta? É a MESMA pergunta que o servidor responde, feita em memória — para
 * quem só lê o que o nomeia, que recebe a janela restrita no lugar da consulta (a regra recusaria
 * somar o plano à visibilidade).
 */
export const recordMatchesQuery = (
  record: object,
  spec: Pick<RecordQuerySpec, 'anyOf' | 'allOf' | 'range'>,
): boolean => {
  const stored = record as Record<string, unknown>;
  if (spec.anyOf.length > 0 && !spec.anyOf.some((clause) => clauseMatches(stored[clause.field], clause))) return false;
  if (!spec.allOf.every((clause) => clauseMatches(stored[clause.field], clause))) return false;
  if (!spec.range) return true;
  const day = toDateFieldInput(stored[spec.range.field]);
  if (!day) return false;
  return (!spec.range.from || day >= spec.range.from) && (!spec.range.to || day <= spec.range.to);
};

const sortableOf = (value: unknown): number | string | null => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
};

/** A ordem do servidor, refeita em memória. O valor ausente vai para o fim, nas duas direções. */
export const orderRecordsBy = <T extends object>(records: readonly T[], orderBy: RecordQuerySpec['orderBy']): T[] => {
  if (!orderBy) return [...records];
  const sign = orderBy.dir === 'desc' ? -1 : 1;
  return [...records].sort((left, right) => {
    const a = sortableOf((left as Record<string, unknown>)[orderBy.field]);
    const b = sortableOf((right as Record<string, unknown>)[orderBy.field]);
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    return a < b ? -sign : a > b ? sign : 0;
  });
};
