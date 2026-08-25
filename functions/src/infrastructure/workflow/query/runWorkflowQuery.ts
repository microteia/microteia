import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { IWorkflowQueryRepository, WorkflowEqualityFilter, WorkflowQueryRow } from '../../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../../domain/repositories/IWorkflowRecordFetcher';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import { getValueAtPath, parsePath, resolvePath } from '../../../domain/schema/pathResolver';
import type { PathRoot, SchemaContext } from '../../../domain/schema/pathResolver';
import { buildHydrationPlan } from '../../../domain/schema/hydrationPlan';
import { collectHopRecordRefs, materializeHops, recordKey } from '../../../domain/schema/materialize';
import type { QueryOrderBy, QueryPredicate, QuerySpec } from '../../../domain/schema/querySpec';
import { resolveQueryTable, validateQuerySpec } from '../../../domain/schema/querySpec';
import { applyDerivedFields, collectDerivedFieldKeys } from '../../../domain/schema/recordRules';

const MAX_SCAN = 300;
const MAX_QUERY_LIMIT = 100;

export interface WorkflowQueryDeps {
  queryRepository: IWorkflowQueryRepository;
  fetcher: IWorkflowRecordFetcher;
  screenProvider: IScreenDefinitionProvider;
}

export interface WorkflowQueryResult {
  count: number;
  results: Record<string, unknown>[];
  first: Record<string, unknown> | null;
}

export type WorkflowQueryOutcome =
  | { ok: true; value: WorkflowQueryResult }
  /** `error` é uma REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  | { ok: false; error: string; errorParams?: Record<string, string> };

interface ResolvedPredicate extends QueryPredicate {
  resolvedValue: unknown;
}

const toMillis = (value: unknown): number | undefined => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const looseEquals = (a: unknown, b: unknown): boolean => {
  if (a instanceof Date || b instanceof Date) {
    const am = toMillis(a);
    const bm = toMillis(b);
    return am !== undefined && am === bm;
  }
  if (typeof a === 'number' && typeof b === 'string') return a === Number(b);
  if (typeof a === 'string' && typeof b === 'number') return Number(a) === b;
  return a === b;
};

const compare = (a: unknown, b: unknown): number | undefined => {
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

const evaluatePredicate = (record: Record<string, unknown>, predicate: ResolvedPredicate): boolean => {
  const actual = getValueAtPath(record, parsePath(predicate.path));
  const expected = predicate.resolvedValue;

  switch (predicate.op) {
    case 'eq':
      return looseEquals(actual, expected);
    case 'neq':
      return !looseEquals(actual, expected);
    case 'lt': {
      const c = compare(actual, expected);
      return c !== undefined && c < 0;
    }
    case 'lte': {
      const c = compare(actual, expected);
      return c !== undefined && c <= 0;
    }
    case 'gt': {
      const c = compare(actual, expected);
      return c !== undefined && c > 0;
    }
    case 'gte': {
      const c = compare(actual, expected);
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

const applyOrdering = (records: Record<string, unknown>[], orderBy: QueryOrderBy[]): Record<string, unknown>[] =>
  [...records].sort((left, right) => {
    for (const order of orderBy) {
      const lv = getValueAtPath(left, parsePath(order.path));
      const rv = getValueAtPath(right, parsePath(order.path));
      const c = compare(lv, rv) ?? 0;
      if (c !== 0) return order.dir === 'desc' ? -c : c;
    }
    return 0;
  });

const materializeRecords = async (
  rows: WorkflowQueryRow[],
  root: PathRoot,
  ctx: SchemaContext,
  paths: string[],
  tenantId: string,
  fetcher: IWorkflowRecordFetcher,
): Promise<Record<string, unknown>[]> => {
  const baseRecords: Record<string, unknown>[] = rows.map((row) => ({ id: row.id, ...row.data }));
  if (paths.length === 0) return baseRecords;

  const plan = buildHydrationPlan(ctx, root, paths);
  if (plan.levels.length === 0) return baseRecords;

  const cache = new Map<string, Record<string, unknown> | null>();
  let records: Record<string, unknown>[] = baseRecords;

  for (const hops of plan.levels) {
    if (hops.length === 0) continue;

    const missingRefs = records
      .flatMap((record) => collectHopRecordRefs(record, hops))
      .filter((ref) => !cache.has(recordKey(ref.collection, ref.id)));

    const idsByCollection = new Map<string, Set<string>>();
    for (const ref of missingRefs) {
      const set = idsByCollection.get(ref.collection) ?? new Set<string>();
      set.add(ref.id);
      idsByCollection.set(ref.collection, set);
    }
    for (const [collection, ids] of idsByCollection) {
      const fetched = await fetcher.fetchByIds(tenantId, collection, [...ids]);
      fetched.forEach((data, id) => cache.set(recordKey(collection, id), data));
    }

    records = records.map((record) => materializeHops(record, hops, cache));
  }

  return records;
};

export async function runWorkflowQuery(
  spec: QuerySpec,
  context: WorkflowContext,
  deps: WorkflowQueryDeps,
): Promise<WorkflowQueryOutcome> {
  const tenantId = context.execution.tenantId;
  const ctx = await deps.screenProvider.getSchemaContext(tenantId);

  const issues = validateQuerySpec(spec, ctx);
  if (issues.length > 0) {
    return {
      ok: false,
      error: '@core.automation/query.invalid',
      errorParams: { detail: issues.map((issue) => `${issue.field}: ${issue.error}`).join('; ') },
    };
  }

  const resolved = resolveQueryTable(spec.table, ctx);
  if (!resolved) {
    return {
      ok: false,
      error: '@core.automation/mutation.table.unknown',
      errorParams: { table: spec.table },
    };
  }

  // Campo derivado (`logic.derive`) não existe no documento: ele é avaliado na leitura, logo abaixo.
  // Um predicado sobre ele NUNCA pode virar filtro de igualdade no Firestore — a consulta voltaria
  // vazia, e vazio não se distingue de "nenhum registro atende". Ele fica em memória, como já ficam
  // os predicados de caminho profundo.
  const derivedKeys = collectDerivedFieldKeys(ctx, spec.table);
  const isDerivedPath = (path: string): boolean => derivedKeys.has(path.split('.')[0]);

  const predicates: ResolvedPredicate[] = spec.where.map((predicate) => ({
    ...predicate,
    resolvedValue: predicate.value ? resolveMapping(predicate.value, context) : undefined,
  }));

  const equalityFilters: WorkflowEqualityFilter[] = [];
  const memoryPredicates: ResolvedPredicate[] = [];
  for (const predicate of predicates) {
    const isDeep = resolvePath(ctx, resolved.root, parsePath(predicate.path)).hops.length > 0;
    if (
      predicate.op === 'eq' &&
      predicate.resolvedValue !== undefined &&
      !isDeep &&
      !isDerivedPath(predicate.path)
    ) {
      equalityFilters.push({ path: predicate.path, value: predicate.resolvedValue });
    } else {
      memoryPredicates.push(predicate);
    }
  }

  const rows = await deps.queryRepository.queryByEquality(tenantId, resolved.physicalCollection, equalityFilters, MAX_SCAN);

  const pathsToHydrate = [
    ...new Set([
      ...spec.projections,
      ...memoryPredicates.map((predicate) => predicate.path),
      ...(spec.orderBy?.map((order) => order.path) ?? []),
    ]),
  ];

  const hydrated = await materializeRecords(rows, resolved.root, ctx, pathsToHydrate, tenantId, deps.fetcher);

  // O instante é um só para a consulta inteira: dois registros da mesma resposta não podem discordar
  // sobre que dia é hoje.
  const at = new Date();
  const materialized =
    derivedKeys.size === 0
      ? hydrated
      : hydrated.map((record) => applyDerivedFields(ctx, spec.table, record, at));

  let results = materialized.filter((record) =>
    memoryPredicates.every((predicate) => evaluatePredicate(record, predicate)),
  );
  if (spec.orderBy && spec.orderBy.length > 0) {
    results = applyOrdering(results, spec.orderBy);
  }
  const limited = results.slice(0, Math.min(spec.limit, MAX_QUERY_LIMIT));

  return {
    ok: true,
    value: {
      results: limited,
      count: limited.length,
      first: limited[0] ?? null,
    },
  };
}
