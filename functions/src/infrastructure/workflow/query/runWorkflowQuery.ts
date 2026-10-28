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
import { QUERY_MAX_RESULTS, QUERY_MAX_SCAN, resolveQueryTable, validateQuerySpec } from '../../../domain/schema/querySpec';
import { applyDerivedFields, collectDerivedFieldKeys } from '../../../domain/schema/recordRules';
import { withAmbientTimeZone } from '../../../domain/schema/clockGate';
import { withAmbientBusinessCalendars } from '../../../domain/schema/time/businessDaysGate';
import type { BusinessCalendarSet } from '../../../domain/schema/time/businessDays';
import { tableMentionsBusinessDays } from '../../../domain/schema/recordRules';
import { businessCalendarsFor } from '../../../domain/services/businessCalendarScope';
import { compareValues, evaluateResolvedPredicate } from '../../../domain/schema/predicateMatch';
import { deterministicRecordOrder } from '../../../domain/schema/recordOrder';
import type { ResolvedPredicate as SharedResolvedPredicate } from '../../../domain/schema/predicateMatch';
import type { RecordReader } from '../../../domain/schema/memberVisibility';
import { readerRestriction, resolveMemberVisibility } from '../../../domain/schema/memberVisibility';
import { readerFetcher, scanVisibleRows } from './readerScope';
import { compareDocumentIds } from './documentIdOrder';

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
  maxScan: QUERY_MAX_SCAN,
  maxResults: QUERY_MAX_RESULTS,
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
  /**
   * Ficou algo de fora da resposta: o teto de varredura foi atingido, ou mais registros atendiam do que
   * o `limit` (ou o teto de resultados) deixou levar. É o que separa "são só estes" de "são estes, e há
   * mais".
   */
  hasMore: boolean;
  /**
   * Na leitura em páginas (`QuerySpec.page`), o valor de `page.after` da próxima página; `null` quando a
   * coleção acabou. Fora dela, sempre `null`.
   */
  cursor: string | null;
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

const applyDeterministicOrdering = (
  records: Record<string, unknown>[],
  orderBy: QueryOrderBy[],
): Record<string, unknown>[] =>
  [...records].sort(deterministicRecordOrder(
    orderBy,
    (record, path) => getValueAtPath(record, parsePath(path)),
    (record) => String(record.id ?? ''),
  ));

/**
 * Como quem chama quer a ordem. `deterministicOrder` troca a ordem simples pela do `latest` — vazio
 * por último, depois `createdAt`, depois o id — e é o que um documento usa: com `limit`, um empate
 * resolvido ao acaso decide QUAIS registros entram. Fica opcional para que a automação e o Script
 * continuem recebendo exatamente a ordem de sempre.
 */
export interface RecordQueryOptions {
  deterministicOrder?: boolean;
  /** O valor já resolvido de `spec.page.after`, quando a consulta lê em páginas. */
  pageAfter?: unknown;
}

type PageCursor = { ok: true; after: string | undefined } | { ok: false };

/**
 * O cursor recebido. Vazio é a primeira página; um valor que não é texto é RECUSADO, e não tratado
 * como começo — recomeçar em silêncio faria a automação que percorre a coleção voltar ao início para
 * sempre.
 */
const pageCursor = (value: unknown): PageCursor => {
  if (value === undefined || value === null || value === '') return { ok: true, after: undefined };
  return typeof value === 'string' ? { ok: true, after: value } : { ok: false };
};

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

const isDocumentIdPath = (resolution: PathResolution, path: string): boolean =>
  resolution.hops.length === 0 && path.trim() === 'id';

/**
 * Os ids que um predicado sobre o id DO DOCUMENTO pede, ou `null` quando ele não é uma busca por id.
 *
 * O documento não guarda o próprio id — o repositório o retira antes de gravar —, então `id == X`
 * descido como filtro de campo voltava SEMPRE vazio, e `id in [...]` só via o que coubesse no teto
 * de varredura. Ler por id é o que o banco responde sem índice nenhum e sem varredura: a pergunta
 * "leia o registro X" deixa de depender de o id ter chegado por uma referência do evento.
 */
const requestedDocumentIds = (predicate: ResolvedPredicate): string[] | null => {
  const value = predicate.resolvedValue;
  if (predicate.op === 'eq') {
    return typeof value === 'string' || typeof value === 'number' ? [String(value)] : null;
  }
  if (predicate.op === 'in' && Array.isArray(value)) {
    return value
      .filter((item): item is string | number => typeof item === 'string' || typeof item === 'number')
      .map(String);
  }
  return null;
};

const intersectIds = (current: string[] | null, next: string[]): string[] =>
  current === null ? [...new Set(next)] : current.filter((id) => next.includes(id));

const rowsByDocumentId = async (
  ids: string[],
  tenantId: string,
  collection: string,
  fetcher: IWorkflowRecordFetcher,
): Promise<WorkflowQueryRow[]> => {
  if (ids.length === 0) return [];
  const fetched = await fetcher.fetchByIds(tenantId, collection, ids);
  return ids.flatMap((id) => {
    const data = fetched.get(id);
    return data ? [{ id, data }] : [];
  });
};

/**
 * Traz os registros apontados pelos CAMINHOS e os põe no lugar dos ids — nível a nível, uma leitura
 * por coleção por nível. É o mesmo par do `WorkflowContextHydrator` (`buildHydrationPlan` +
 * `materializeHops`), aplicado a uma lista em vez de ao evento.
 */
export const hydrateRecords = async (
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

/**
 * Quem consulta, quando não é uma execução de automação: o escritório e o fuso em que `today()` diz
 * que dia é. A geração de documento consulta os registros filhos por aqui.
 */
export interface RecordQueryScope {
  tenantId: string;
  timeZone?: string;
  /** Os calendários de dias úteis já carregados pela execução, quando ela os tem. */
  businessCalendars?: BusinessCalendarSet | null;
  /** Carrega os calendários quando um campo derivado da tabela conta dias úteis e ninguém os trouxe. */
  businessCalendarsOf?(tenantId: string): Promise<BusinessCalendarSet | null>;
  /**
   * A pessoa a quem o resultado é entregue (`WorkflowContext.reader`). Presente, a visibilidade por
   * registro vale: a consulta traz só o que ela vê, e a hidratação não entrega o registro apontado que
   * ela não vê. Ausente, quem lê é o escritório.
   */
  reader?: RecordReader | null;
}

export async function runWorkflowQuery(
  spec: QuerySpec,
  context: WorkflowContext,
  deps: WorkflowQueryDeps,
  limits: WorkflowQueryLimits = DEFAULT_WORKFLOW_QUERY_LIMITS,
): Promise<WorkflowQueryOutcome> {
  const values = spec.where.map((predicate) => (predicate.value ? resolveMapping(predicate.value, context) : undefined));
  const pageAfter = spec.page?.after ? resolveMapping(spec.page.after, context) : undefined;
  return runRecordQuery(
    spec,
    values,
    {
      tenantId: context.execution.tenantId,
      timeZone: context.services.timeZone,
      businessCalendars: context.services.businessCalendars,
      businessCalendarsOf: context.services.businessCalendarsOf,
      reader: context.reader,
    },
    deps,
    limits,
    { pageAfter },
  );
}

/**
 * A consulta sem o contexto de execução: os valores dos predicados já chegam resolvidos, na ordem de
 * `spec.where`. É o mesmo caminho — mesma divisão entre o que desce ao Firestore e o que fica em
 * memória, mesmos tetos, mesma derivação na leitura —, e por isso uma automação e um documento que
 * fazem a mesma pergunta recebem a mesma resposta.
 */
export async function runRecordQuery(
  spec: QuerySpec,
  values: unknown[],
  scope: RecordQueryScope,
  deps: WorkflowQueryDeps,
  limits: WorkflowQueryLimits = DEFAULT_WORKFLOW_QUERY_LIMITS,
  options: RecordQueryOptions = {},
): Promise<WorkflowQueryOutcome> {
  const tenantId = scope.tenantId;
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

  const paging = spec.page !== undefined;
  const cursor = paging ? pageCursor(options.pageAfter) : { ok: true as const, after: undefined };
  if (!cursor.ok) {
    return {
      ok: false,
      error: '@core.automation/query.page.cursor-invalid',
      errorParams: { cursor: JSON.stringify(options.pageAfter) ?? '' },
    };
  }
  const after = cursor.after;
  const page = paging ? { after } : undefined;

  // Campo derivado (`logic.derive`) não existe no documento: ele é avaliado na leitura, logo abaixo.
  // Um predicado sobre ele NUNCA pode virar filtro de igualdade no Firestore — a consulta voltaria
  // vazia, e vazio não se distingue de "nenhum registro atende". Ele fica em memória, como já ficam
  // os predicados de caminho profundo.
  const derivedKeys = collectDerivedFieldKeys(ctx, spec.table);
  const isDerivedPath = (path: string): boolean => derivedKeys.has(path.split('.')[0]);

  const predicates: ResolvedPredicate[] = spec.where.map((predicate, index) => ({
    ...predicate,
    resolvedValue: values[index],
  }));

  const equalityFilters: WorkflowEqualityFilter[] = [];
  const memoryPredicates: ResolvedPredicate[] = [];
  let documentIds: string[] | null = null;
  for (const predicate of predicates) {
    const resolution = resolvePath(ctx, resolved.root, parsePath(predicate.path));
    if (isDocumentIdPath(resolution, predicate.path)) {
      const ids = requestedDocumentIds(predicate);
      if (ids !== null) documentIds = intersectIds(documentIds, ids);
      memoryPredicates.push(predicate);
      continue;
    }
    // Data contra TEXTO não desce: o documento guarda um Timestamp, e o Firestore compara tipos
    // diferentes como diferentes — "2026-10-01" nunca seria igual a nada. Em memória o texto vira o
    // dia inteiro, que é o que quem filtra por um dia está perguntando.
    const isDateAgainstText =
      resolution.node.kind === 'scalar' &&
      resolution.node.type === 'date' &&
      typeof predicate.resolvedValue === 'string';
    const atPath =
      predicate.op === 'eq' &&
      predicate.resolvedValue !== undefined &&
      !Array.isArray(predicate.resolvedValue) &&
      !isDateAgainstText &&
      !isDerivedPath(predicate.path)
        ? documentFieldPath(resolution, predicate.path)
        : null;

    if (atPath !== null) equalityFilters.push({ path: atPath, value: predicate.resolvedValue });
    else memoryPredicates.push(predicate);
  }

  // Quem lê pode ver só parte da coleção (`memberVisibility`). O fetcher filtrado vale para a leitura
  // por id e para a hidratação; a varredura de quem é restrito pergunta ao banco só pelo que o nomeia.
  const fetcher = readerFetcher(deps.fetcher, ctx, scope.reader);
  const restriction = readerRestriction(
    resolveMemberVisibility(ctx, resolved.physicalCollection),
    resolved.physicalCollection,
    scope.reader,
  );

  // Com ids em mãos, a leitura é direta e a varredura não acontece: os demais filtros de igualdade
  // são conferidos em memória, sobre os poucos registros pedidos. A varredura de quem é restrito
  // também os confere: metade das consultas dela não os leva.
  const byId = documentIds !== null;
  const restrictedScan = !byId && restriction !== null && scope.reader
    ? await scanVisibleRows(
      deps.queryRepository,
      tenantId,
      resolved.physicalCollection,
      equalityFilters,
      restriction,
      scope.reader.uid,
      limits.maxScan,
      page,
    )
    : null;
  if (byId || restrictedScan) {
    memoryPredicates.push(...predicates.filter((predicate) => !memoryPredicates.includes(predicate)));
  }
  // Em páginas, os ids pedidos seguem a mesma ordem da varredura, e só os depois do cursor contam.
  const pendingIds = documentIds !== null && paging
    ? documentIds
      .filter((id) => after === undefined || compareDocumentIds(id, after) > 0)
      .sort(compareDocumentIds)
    : documentIds;
  const requestedIds = pendingIds?.slice(0, limits.maxScan) ?? [];
  const rows = byId
    ? await rowsByDocumentId(requestedIds, tenantId, resolved.physicalCollection, fetcher)
    : restrictedScan?.rows
      ?? await deps.queryRepository.queryByEquality(tenantId, resolved.physicalCollection, equalityFilters, limits.maxScan, page);
  const complete = byId
    ? (pendingIds?.length ?? 0) <= limits.maxScan
    : restrictedScan?.complete ?? rows.length < limits.maxScan;

  const pathsToHydrate = [
    ...new Set([
      ...spec.projections,
      ...memoryPredicates.map((predicate) => predicate.path),
      ...(spec.orderBy?.map((order) => order.path) ?? []),
    ]),
  ];

  const hydrated = await hydrateRecords(rows, resolved.root, ctx, pathsToHydrate, tenantId, fetcher);

  // O instante é um só para a consulta inteira: dois registros da mesma resposta não podem discordar
  // sobre que dia é hoje.
  const at = new Date();
  const calendars =
    derivedKeys.size === 0
      ? undefined
      : await businessCalendarsFor(scope, tenantId, tableMentionsBusinessDays(ctx, spec.table));
  const materialized =
    derivedKeys.size === 0
      ? hydrated
      : withAmbientBusinessCalendars(calendars, () =>
          withAmbientTimeZone(scope.timeZone, () =>
            hydrated.map((record) => applyDerivedFields(ctx, spec.table, record, at)),
          ),
        );

  let results = materialized.filter((record) =>
    memoryPredicates.every((predicate) => evaluateResolvedPredicate(record, asShared(predicate))),
  );
  if (spec.orderBy && spec.orderBy.length > 0) {
    results = options.deterministicOrder
      ? applyDeterministicOrdering(results, spec.orderBy)
      : applyOrdering(results, spec.orderBy);
  }
  const cap = Math.min(spec.limit, limits.maxResults);
  const limited = results.slice(0, cap);
  const truncated = results.length > cap;

  // O próximo cursor é o último registro CONSUMIDO: o último entregue, quando o corte foi o `limit`; o
  // último varrido, quando foi o teto de varredura. Como cada página consome pelo menos um registro, a
  // sequência sempre avança.
  const lastScannedId = byId ? requestedIds[requestedIds.length - 1] : rows[rows.length - 1]?.id;
  const nextCursor = !paging
    ? null
    : truncated
      ? String(limited[limited.length - 1].id)
      : complete ? null : lastScannedId ?? null;

  return {
    ok: true,
    value: {
      results: limited,
      count: limited.length,
      first: limited[0] ?? null,
      scanned: rows.length,
      complete,
      hasMore: paging ? nextCursor !== null : truncated || !complete,
      cursor: nextCursor,
    },
  };
}
