// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/optionsFilter.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { getValueAtPath, parsePath } from './pathResolver';
import { evaluateResolvedPredicate, startsWithValue } from './predicateMatch';
import type { CustomFieldValue, FieldDefinition } from '../entities/entitySchemas';

/**
 * O filtro das OPÇÕES de um campo pelo que o formulário já tem: a raça pelo tipo do animal, a cidade
 * pelo estado, o tipo de notícia pelo prefixo da região. Uma capacidade só para os dois campos que
 * oferecem opções — a referência filtra os registros da tela apontada, a lista filtra as próprias
 * opções —, porque a pergunta é a mesma e duas formas de escrevê-la divergiriam no primeiro operador.
 *
 * É regra de FORMULÁRIO, e só dele. Quem grava por outro caminho (automação, importação, agente)
 * responde pelo valor que grava: o filtro diz o que o formulário oferece, não o que o registro admite.
 *
 * O operador é um subconjunto do `QueryOperator`, mais `startsWith`. Ordem (`lt`, `gte`) não entra
 * porque não filtra opção que ninguém digitou; `startsWith` entra porque uma lista do escritório só
 * tem chave e rótulo, e o prefixo da chave é como ela costuma ser agrupada.
 */
export type OptionsFilterOperator = 'eq' | 'neq' | 'in' | 'contains' | 'startsWith';

export const OPTIONS_FILTER_OPERATORS: readonly OptionsFilterOperator[] = ['eq', 'neq', 'in', 'contains', 'startsWith'];

export type OptionsFilterLiteral = string | number | boolean | string[];

/**
 * De onde vem o valor comparado: um campo do registro em edição — que pode atravessar uma referência,
 * `cliente.cidade` —, ou um valor fixo.
 */
export type OptionsFilterValue = { field: string } | { literal: OptionsFilterLiteral };

export interface OptionsFilterPredicate {
  /**
   * O que se lê da OPÇÃO. Numa referência, um campo da tela apontada; numa lista, `key` ou `label`
   * (`LOOKUP_OPTION_FILTER_PATHS`).
   */
  path: string;
  op: OptionsFilterOperator;
  value: OptionsFilterValue;
}

export interface OptionsFilterSpec {
  /** Conjunção: a opção é oferecida quando passa em todos. */
  where: OptionsFilterPredicate[];
}

/**
 * O que uma opção de lista expõe ao filtro. `label` é o rótulo NO IDIOMA de quem lê: numa opção fixa,
 * a mesma lista responde diferente em outro idioma — e por isso `key`, que é o valor gravado, é o
 * caminho a preferir.
 */
export const LOOKUP_OPTION_FILTER_PATHS = ['key', 'label'] as const;

interface ResolvedOptionsFilterPredicate {
  path: string;
  op: OptionsFilterOperator;
  value: unknown;
}

/**
 * O filtro com os valores do formulário já lidos. `blocked` é a origem vazia: enquanto o campo de que
 * a lista depende não tem valor, não há opção a oferecer — o mesmo vazio de qualquer lista sem itens.
 */
export interface ResolvedOptionsFilter {
  blocked: boolean;
  predicates: ResolvedOptionsFilterPredicate[];
}

const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

const topLevelKey = (path: string): string => {
  const first = parsePath(path)[0];
  return first?.kind === 'key' ? first.name : '';
};

/** As chaves de topo do formulário de que o filtro depende — o que, mudando, pode invalidar a escolha. */
export const optionsFilterSourceKeys = (spec: OptionsFilterSpec | null | undefined): string[] => {
  const keys = new Set<string>();
  for (const predicate of spec?.where ?? []) {
    if ('field' in predicate.value) {
      const key = topLevelKey(predicate.value.field);
      if (key) keys.add(key);
    }
  }
  return [...keys];
};

/** `null` é "sem filtro": a declaração ausente ou vazia oferece tudo, como sempre ofereceu. */
export const resolveOptionsFilter = (
  spec: OptionsFilterSpec | null | undefined,
  scope: Record<string, unknown>,
): ResolvedOptionsFilter | null => {
  const where = spec?.where ?? [];
  if (where.length === 0) return null;
  const predicates: ResolvedOptionsFilterPredicate[] = [];
  for (const predicate of where) {
    const value = 'field' in predicate.value
      ? getValueAtPath(scope, parsePath(predicate.value.field))
      : predicate.value.literal;
    if (isEmptyValue(value)) return { blocked: true, predicates: [] };
    predicates.push({ path: predicate.path, op: predicate.op, value });
  }
  return { blocked: false, predicates };
};

export const matchesOptionsFilter = (
  candidate: Record<string, unknown>,
  filter: ResolvedOptionsFilter,
): boolean => {
  if (filter.blocked) return false;
  return filter.predicates.every((predicate) => {
    if (predicate.op === 'startsWith') {
      return startsWithValue(getValueAtPath(candidate, parsePath(predicate.path)), predicate.value);
    }
    return evaluateResolvedPredicate(candidate, { path: predicate.path, op: predicate.op, value: predicate.value });
  });
};

/**
 * O filtro que vale para um campo NESTE formulário. Um filtro que depende de campo ausente do
 * formulário não é aplicado: é o caso do átomo `FieldInput`, que desenha um campo sozinho — esconder
 * todas as opções porque o formulário não tem a origem seria responder por um valor que ninguém leu.
 */
export const formOptionsFilter = (
  field: FieldDefinition,
  formKeys: ReadonlySet<string>,
  scope: Record<string, unknown>,
): ResolvedOptionsFilter | null => {
  if (field.type !== 'reference' && field.type !== 'select') return null;
  const spec = field.optionsFilter;
  if (!spec?.where?.length) return null;
  if (optionsFilterSourceKeys(spec).some((key) => !formKeys.has(key))) return null;
  return resolveOptionsFilter(spec, scope);
};

/**
 * Lê a opção que um valor gravado designa: o registro apontado, ou `{ key, label }` da lista. `null`
 * quando ela não é conhecida aqui — o registro ainda não carregou, a opção saiu da lista.
 */
export type OptionsFilterCandidateOf = (field: FieldDefinition, value: string) => Record<string, unknown> | null;

/**
 * O valor do campo depois de descartadas as escolhas que o filtro não oferece mais.
 *
 * Opção DESCONHECIDA fica: não há como dizer que ela não passa, e apagar o que não se leu é perder dado
 * em silêncio. A origem vazia é a exceção — ali nenhuma opção passa, conhecida ou não.
 */
export const keepOptionsFilterValue = (
  field: FieldDefinition,
  value: CustomFieldValue | undefined,
  filter: ResolvedOptionsFilter,
  candidateOf: OptionsFilterCandidateOf,
): CustomFieldValue | undefined => {
  const passes = (item: string): boolean => {
    if (filter.blocked) return false;
    const candidate = candidateOf(field, item);
    return candidate === null || matchesOptionsFilter(candidate, filter);
  };
  if (Array.isArray(value)) {
    const kept = value.filter(passes);
    return kept.length === value.length ? value : kept;
  }
  if (typeof value === 'string' && value !== '' && !passes(value)) return null;
  return value;
};

/** Os campos cujo valor o filtro não oferece — a validação do formulário antes de gravar. */
export const findOptionsFilterViolations = (
  fields: readonly FieldDefinition[],
  values: Record<string, unknown>,
  scope: Record<string, unknown>,
  candidateOf: OptionsFilterCandidateOf,
): FieldDefinition[] => {
  const formKeys = new Set(fields.map((field) => field.key));
  return fields.filter((field) => {
    const filter = formOptionsFilter(field, formKeys, scope);
    if (!filter) return false;
    const value = values[field.key] as CustomFieldValue | undefined;
    return keepOptionsFilterValue(field, value, filter, candidateOf) !== value;
  });
};

/**
 * As escolhas que uma alteração invalida, em CASCATA: limpar o estado invalida a cidade, que pode
 * invalidar o bairro. Devolve só o que mudou, na ordem em que mudou, para o formulário aplicar como
 * se a pessoa tivesse limpado cada campo.
 */
export const optionsFilterCascade = (
  fields: readonly FieldDefinition[],
  changedKey: string,
  values: Record<string, unknown>,
  scopeOf: (values: Record<string, unknown>) => Record<string, unknown>,
  candidateOf: OptionsFilterCandidateOf,
): { key: string; value: CustomFieldValue }[] => {
  const formKeys = new Set(fields.map((field) => field.key));
  const dependents = fields.filter((field) => optionsFilterSourceKeys(field.optionsFilter).length > 0);
  if (dependents.length === 0) return [];

  const changes: { key: string; value: CustomFieldValue }[] = [];
  let current = values;
  const queue = [changedKey];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const key = queue.shift() as string;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const field of dependents) {
      if (!optionsFilterSourceKeys(field.optionsFilter).includes(key)) continue;
      const filter = formOptionsFilter(field, formKeys, scopeOf(current));
      if (!filter) continue;
      const value = current[field.key] as CustomFieldValue | undefined;
      const kept = keepOptionsFilterValue(field, value, filter, candidateOf);
      if (kept === value) continue;
      const next = kept ?? null;
      current = { ...current, [field.key]: next };
      changes.push({ key: field.key, value: next });
      queue.push(field.key);
    }
  }
  return changes;
};
