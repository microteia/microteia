import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { IWorkflowQueryRepository, WorkflowEqualityFilter, WorkflowQueryRow } from '../../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../../domain/repositories/IWorkflowRecordFetcher';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import { getValueAtPath, parsePath, resolvePath } from '../../../domain/schema/pathResolver';
import type { PathResolution, PathRoot, SchemaContext } from '../../../domain/schema/pathResolver';
import { buildHydrationPlan } from '../../../domain/schema/hydrationPlan';
import { collectHopRecordRefs, materializeHops, recordKey } from '../../../domain/schema/materialize';
import type { QueryOrderBy, QueryPredicate, QuerySpec } from '../../../domain/schema/querySpec';
import { resolveQueryTable, validateQuerySpec } from '../../../domain/schema/querySpec';
import { applyDerivedFields, collectDerivedFieldKeys } from '../../../domain/schema/recordRules';
import { compareValues, evaluateResolvedPredicate } from '../../../domain/schema/predicateMatch';
import type { ResolvedPredicate as SharedResolvedPredicate } from '../../../domain/schema/predicateMatch';

const MAX_SCAN = 300;
const MAX_QUERY_LIMIT = 100;

/**
 * Os tetos da consulta, fornecidos por quem chama.
 *
 * Eram constantes fixas, e continuam sendo o PADRÃO — o caminho do workflow não muda uma linha. O
 * relatório precisa varrer mais que 300 para que um total seja um total, e a estratégia índice-free
 * é preservada: o que muda é quantos documentos a varredura traz, nunca como ela é montada.
 */
export interface WorkflowQueryLimits {
  maxScan: number;
  maxResults: number;
}

export const DEFAULT_WORKFLOW_QUERY_LIMITS: WorkflowQueryLimits = {
  maxScan: MAX_SCAN,
  maxResults: MAX_QUERY_LIMIT,
};

export interface WorkflowQueryDeps {
  queryRepository: IWorkflowQueryRepository;
  fetcher: IWorkflowRecordFetcher;
  screenProvider: IScreenDefinitionProvider;
}

export interface WorkflowQueryResult {
  count: number;
  results: Record<string, unknown>[];
  first: Record<string, unknown> | null;
  /** Quantos documentos a varredura trouxe. */
  scanned: number;
  /**
   * A varredura NÃO bateu no teto — ou seja, ela viu a coleção inteira que os filtros de igualdade
   * delimitam.
   *
   * Enquadrado no positivo de propósito: o padrão de um campo esquecido não pode ser "está tudo
   * bem". Isto conserta um defeito latente que já atingia o passo "Buscar Registros": um fluxo que
   * consulta 5000 registros vê 300 e não tinha como saber.
   */
  complete: boolean;
}

export type WorkflowQueryOutcome =
  | { ok: true; value: WorkflowQueryResult }
  /** `error` é uma REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  | { ok: false; error: string; errorParams?: Record<string, string> };

interface ResolvedPredicate extends QueryPredicate {
  resolvedValue: unknown;
}

/** O predicado local no formato do avaliador COMPARTILHADO, que é o mesmo do relatório. */
const asShared = (predicate: ResolvedPredicate): SharedResolvedPredicate =>
  ({ path: predicate.path, op: predicate.op, value: predicate.resolvedValue });

const applyOrdering = (records: Record<string, unknown>[], orderBy: QueryOrderBy[]): Record<string, unknown>[] =>
  [...records].sort((left, right) => {
    for (const order of orderBy) {
      const lv = getValueAtPath(left, parsePath(order.path));
      const rv = getValueAtPath(right, parsePath(order.path));
      const c = compareValues(lv, rv) ?? 0;
      if (c !== 0) return order.dir === 'desc' ? -c : c;
    }
    return 0;
  });

/**
 * O caminho como um campo DO DOCUMENTO, ou `null` quando o banco não pode responder por ele.
 *
 * É aqui que a consulta decide, a partir do esquema, o que ela pergunta ao Firestore e o que ela
 * filtra em memória — e a divisão é sempre a mesma, seja quem chamar: o relatório, o passo de
 * automação ou o Script.
 *
 * Só IGUALDADE desce, e é de propósito: uma conjunção de igualdades é servida pela junção dos
 * índices de campo único, que toda coleção ganha de graça. Coleção de tenant nasce em tempo de
 * execução, e nenhum índice composto pode ser declarado para ela — um `in` ou um `array-contains`
 * ao lado de outro filtro faria a consulta FALHAR pedindo um índice que ninguém tem como criar.
 * Filtrar em memória custa varredura; pedir um índice inexistente custa o relatório inteiro.
 *
 * A referência TERMINAL é um campo do documento como outro qualquer — o documento guarda o id, e é
 * a hidratação, depois e em memória, que põe o registro apontado no lugar dele. Tratá-la como
 * caminho profundo mandava para a memória, e para dentro do teto de varredura, uma pergunta que o
 * banco responde sozinho. Quando ela é navegada pelo nome do apontado (`cliente` para `clienteId`),
 * quem desce é a chave que o documento realmente guarda.
 *
 * Ficam fora, e vão para a memória: o caminho que ENTRA na coleção apontada (`cliente.cidade`), a
 * referência de vários e o campo de lista — ali `==` compara a lista inteira, e a pergunta de um
 * filtro é de pertinência.
 */
const documentFieldPath = (resolution: PathResolution, path: string): string | null => {
  if (resolution.hops.length === 0) {
    const isList = resolution.node.kind === 'scalar' && resolution.node.type === 'stringArray';
    return isList ? null : path;
  }
  if (resolution.hops.length > 1) return null;

  const hop = resolution.hops[0];
  return hop.materializeAt === path && !hop.multi ? hop.atPath : null;
};

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
  limits: WorkflowQueryLimits = DEFAULT_WORKFLOW_QUERY_LIMITS,
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
    const resolution = resolvePath(ctx, resolved.root, parsePath(predicate.path));
    const atPath =
      predicate.op === 'eq' &&
      predicate.resolvedValue !== undefined &&
      !Array.isArray(predicate.resolvedValue) &&
      !isDerivedPath(predicate.path)
        ? documentFieldPath(resolution, predicate.path)
        : null;

    if (atPath !== null) equalityFilters.push({ path: atPath, value: predicate.resolvedValue });
    else memoryPredicates.push(predicate);
  }

  const rows = await deps.queryRepository.queryByEquality(tenantId, resolved.physicalCollection, equalityFilters, limits.maxScan);

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
    memoryPredicates.every((predicate) => evaluateResolvedPredicate(record, asShared(predicate))),
  );
  if (spec.orderBy && spec.orderBy.length > 0) {
    results = applyOrdering(results, spec.orderBy);
  }
  const limited = results.slice(0, Math.min(spec.limit, limits.maxResults));

  return {
    ok: true,
    value: {
      results: limited,
      count: limited.length,
      first: limited[0] ?? null,
      scanned: rows.length,
      complete: rows.length < limits.maxScan,
    },
  };
}
