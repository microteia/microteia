import type { CustomFieldOption, FieldDefinition } from '../entities/entitySchemas';
import type { IRecordSearchRepository, SearchableRecord } from '../repositories/IRecordSearchRepository';
import type { SchemaContext } from '../schema/pathResolver';
import type { MessageCatalog } from '../schema/i18n/messages';
import { parseMessageRef, resolveLabel } from '../schema/i18n/messageRef';
import {
  isRecordSearchJobStalled,
  planRecordSearchBackfill,
  RECORD_SEARCH_ROUND_SIZE,
  recordSearchBackfillJobId,
  recordSearchPropagationJobId,
  recordSearchSignature,
  recordSearchTerms,
  recordSearchTitle,
  sameSearchTerms,
  searchFieldsOf,
  searchLookupReferrersOf,
  searchReferencesOf,
  searchReferrersOf,
  startRecordSearchJob,
  storedSearchTerms,
} from '../schema/recordSearch';
import type {
  RecordSearchJobState,
  RecordSearchScan,
  SearchReferrer,
  SearchScreen,
  SearchTextSources,
} from '../schema/recordSearch';
import { isBookkeepingWrite } from './recordBookkeeping';

export interface RecordSearchDeps {
  repository: IRecordSearchRepository;
  /** O contexto do cache — para a gravação de um registro, que roda em toda escrita. */
  schemaContext: (tenantId: string) => Promise<SchemaContext>;
  /** O contexto relido — para a passada e a conferência, que comparam a assinatura da declaração. */
  freshSchemaContext: (tenantId: string) => Promise<SchemaContext>;
  catalog: (tenantId: string) => Promise<MessageCatalog>;
  now: () => number;
  logger: { warn: (message: string) => void };
}

type CollectionScreen = SearchScreen & { collection: string };

/** A tela de uma coleção, como a busca a lê — `undefined` quando nada nela nomeia o registro. */
const searchScreenOf = (ctx: SchemaContext, collection: string): CollectionScreen | undefined => {
  const screen = ctx.screens.get(collection);
  if (!screen) return undefined;
  const candidate = { collection, titleFieldKey: screen.titleFieldKey, fields: screen.fields };
  return searchFieldsOf(candidate).length > 0 ? candidate : undefined;
};

const searchScreens = (ctx: SchemaContext): CollectionScreen[] =>
  [...ctx.screens.keys()]
    .map((collection) => searchScreenOf(ctx, collection))
    .filter((screen): screen is CollectionScreen => screen !== undefined);

const keysOf = (value: unknown): string[] => {
  if (typeof value === 'string') return value === '' ? [] : [value];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '') : [];
};

const inlineLabel = (field: FieldDefinition, key: string): string | undefined =>
  field.options?.find((option) => option.key === key)?.label;

/**
 * Tudo o que os registros de uma página precisam ler antes de virar termos, numa leitura por
 * coleção apontada e uma por lista — e não uma por registro. O catálogo só é carregado se algum rótulo
 * for referência de mensagem: a lista que o escritório digitou não paga essa leitura.
 */
const textSourcesFor = async (
  tenantId: string,
  ctx: SchemaContext,
  screen: SearchScreen,
  records: readonly Record<string, unknown>[],
  deps: RecordSearchDeps,
): Promise<SearchTextSources> => {
  const titles = new Map<string, string>();
  const needs = new Map<string, Set<string>>();
  for (const data of records) {
    for (const need of searchReferencesOf(screen, data)) {
      const ids = needs.get(need.collection) ?? new Set<string>();
      for (const id of need.ids) ids.add(id);
      needs.set(need.collection, ids);
    }
  }
  await Promise.all([...needs].map(async ([collection, ids]) => {
    const target = searchScreenOf(ctx, collection) ?? { titleFieldKey: '', fields: [] };
    const found = await deps.repository.getRecords(tenantId, collection, [...ids]);
    for (const [id, data] of found) {
      const title = recordSearchTitle(target, data, inlineLabel);
      if (title) titles.set(`${collection}/${id}`, title);
    }
  }));

  const options = new Map<string, CustomFieldOption[]>();
  const lookupKeys = new Map<string, Set<string>>();
  for (const field of searchFieldsOf(screen)) {
    if (field.type !== 'select' || !field.lookupCollection) continue;
    const keys = lookupKeys.get(field.lookupCollection) ?? new Set<string>();
    for (const data of records) for (const key of keysOf(data[field.key])) keys.add(key);
    lookupKeys.set(field.lookupCollection, keys);
  }
  await Promise.all([...lookupKeys].map(async ([collection, keys]) => {
    options.set(collection, keys.size > 0 ? await deps.repository.getLookupOptions(tenantId, collection, [...keys]) : []);
  }));

  const rawLabel = (field: FieldDefinition, key: string): string | undefined =>
    field.lookupCollection
      ? options.get(field.lookupCollection)?.find((option) => option.key === key)?.label
      : inlineLabel(field, key);

  const needsCatalog = searchFieldsOf(screen).some((field) => field.type === 'select')
    && records.some((data) => searchFieldsOf(screen).some((field) =>
      field.type === 'select' && keysOf(data[field.key]).some((key) => parseMessageRef(rawLabel(field, key)) !== null)));
  const catalog = needsCatalog ? await deps.catalog(tenantId) : null;

  return {
    referenceTitle: (collection, id) => titles.get(`${collection}/${id}`),
    optionLabel: (field, key) => {
      const label = rawLabel(field, key);
      return label && catalog ? resolveLabel(catalog, label) : label;
    },
  };
};

const scansFor = (referrers: readonly SearchReferrer[], value: string): RecordSearchScan[] =>
  referrers.map((referrer) => ({ collection: referrer.collection, fieldKey: referrer.fieldKey, multi: referrer.multi, value }));

const startPropagation = async (
  tenantId: string,
  jobId: string,
  scans: RecordSearchScan[],
  deps: RecordSearchDeps,
): Promise<void> => {
  if (scans.length === 0) return;
  // Uma renomeação no meio de outra recomeça do zero: o título que vale é o desta gravação.
  await deps.repository.updateJob(tenantId, jobId, (current) =>
    startRecordSearchJob('propagate', scans, null, current, deps.now()));
};

const labelOf = (data: Record<string, unknown> | null): string =>
  typeof data?.label === 'string' ? data.label : '';

/**
 * Uma gravação de registro. Três coisas, e só as que se aplicam: os termos do PRÓPRIO registro; a
 * propagação para quem o aponta, se o título dele mudou (inclusive porque ele foi apagado); e a
 * propagação para quem usa a opção, se a coleção é uma lista e o rótulo mudou. É a renomeação que
 * paga a propagação, e ela é rara: a gravação comum compara dois títulos e sai.
 */
export const deriveRecordSearchOnWrite = async (
  tenantId: string,
  collection: string,
  recordId: string,
  before: Record<string, unknown> | null,
  after: SearchableRecord | null,
  deps: RecordSearchDeps,
): Promise<void> => {
  const afterData = after?.data ?? null;
  if (isBookkeepingWrite(before, afterData)) return;
  const ctx = await deps.schemaContext(tenantId);
  const screen = searchScreenOf(ctx, collection);

  if (screen && after) {
    const sources = await textSourcesFor(tenantId, ctx, screen, [after.data], deps);
    const terms = recordSearchTerms(screen, after.data, sources);
    if (!sameSearchTerms(terms, storedSearchTerms(after.data))) {
      await deps.repository.writeTerms(tenantId, collection, after, terms);
    }
  }

  // Um registro que acabou de nascer não tem quem o aponte: propagar a criação custaria um job e uma
  // consulta por campo a cada cadastro, para achar nada.
  if (!before) return;

  if (screen && recordSearchTitle(screen, before, inlineLabel) !== recordSearchTitle(screen, afterData, inlineLabel)) {
    const referrers = searchReferrersOf(searchScreens(ctx), collection);
    await startPropagation(tenantId, recordSearchPropagationJobId(collection, recordId), scansFor(referrers, recordId), deps);
  }

  if (ctx.lookups.has(collection) && labelOf(before) !== labelOf(afterData)) {
    const key = keysOf(afterData?.key ?? before.key)[0];
    if (key) {
      const referrers = searchLookupReferrersOf(searchScreens(ctx), collection);
      await startPropagation(tenantId, recordSearchPropagationJobId(collection, recordId), scansFor(referrers, key), deps);
    }
  }
};

/** O que uma rodada processou — para o job somar. */
interface RoundOutcome {
  size: number;
  lastId: string | null;
  written: number;
  failed: number;
}

const processPage = async (
  tenantId: string,
  ctx: SchemaContext,
  screen: SearchScreen,
  scan: RecordSearchScan,
  cursor: string | null,
  deps: RecordSearchDeps,
): Promise<RoundOutcome> => {
  const page = await deps.repository.scanPage(tenantId, scan, cursor, RECORD_SEARCH_ROUND_SIZE);
  const sources = await textSourcesFor(tenantId, ctx, screen, page.map((record) => record.data), deps);
  let written = 0;
  let failed = 0;
  for (const record of page) {
    try {
      const terms = recordSearchTerms(screen, record.data, sources);
      if (sameSearchTerms(terms, storedSearchTerms(record.data))) continue;
      if (await deps.repository.writeTerms(tenantId, scan.collection, record, terms)) written += 1;
    } catch (error) {
      failed += 1;
      deps.logger.warn(`${tenantId}/${scan.collection}/${record.id}: ${(error as Error).message}`);
    }
  }
  return { size: page.length, lastId: page.at(-1)?.id ?? null, written, failed };
};

/**
 * Uma rodada de um job: uma página da varredura em curso, e o avanço. É a gravação do avanço que
 * acorda a rodada seguinte, e ela só vale sobre a geração e a rodada que esta leu — uma entrega
 * repetida do gatilho processa a mesma página de novo (a derivação é idempotente) e perde o avanço.
 */
export const runRecordSearchRound = async (
  tenantId: string,
  jobId: string,
  eventRound: number,
  deps: RecordSearchDeps,
): Promise<void> => {
  const state = await deps.repository.getJob(tenantId, jobId);
  if (!state || state.status !== 'running' || state.round !== eventRound) return;

  const scan = state.scans[state.scanIndex];
  const ctx = state.kind === 'backfill' ? await deps.freshSchemaContext(tenantId) : await deps.schemaContext(tenantId);
  const screen = scan ? searchScreenOf(ctx, scan.collection) : undefined;

  // A declaração mudou depois que a passada começou: a conferência que a mudança dispara recomeça
  // com a assinatura nova. Seguir aqui gravaria termos de uma regra que já não vale.
  if (state.kind === 'backfill' && screen && recordSearchSignature(screen) !== state.signature) return;

  // Varredura de uma tela que saiu (ou que já não tem o que buscar) termina vazia.
  const outcome: RoundOutcome = scan && screen
    ? await processPage(tenantId, ctx, screen, scan, state.cursor, deps)
    : { size: 0, lastId: null, written: 0, failed: 0 };

  await deps.repository.updateJob(tenantId, jobId, (current) => {
    if (!current || current.status !== 'running' || current.generation !== state.generation || current.round !== state.round) {
      return null;
    }
    const exhausted = outcome.size < RECORD_SEARCH_ROUND_SIZE;
    const scanIndex = exhausted ? current.scanIndex + 1 : current.scanIndex;
    const done = scanIndex >= current.scans.length;
    if (done && current.kind === 'propagate') return 'delete';
    const next: RecordSearchJobState = {
      ...current,
      status: done ? 'done' : 'running',
      scanIndex: done ? current.scanIndex : scanIndex,
      cursor: exhausted ? null : outcome.lastId,
      round: current.round + 1,
      touchedAt: deps.now(),
      processed: current.processed + outcome.size,
      written: current.written + outcome.written,
      failed: current.failed + outcome.failed,
    };
    return next;
  });
};

/**
 * A conferência: põe em marcha o backfill de toda coleção cuja declaração de busca não é a que o job
 * derivou, e acorda o job parado. Roda quando uma tela é gravada e quando a listagem pede — é a segunda
 * porta que cobre o escritório que atualizou o kernel com milhares de registros sem termo nenhum, e em
 * que nenhuma tela muda depois. Devolve quantos jobs ela mexeu.
 */
export const reconcileRecordSearch = async (tenantId: string, deps: RecordSearchDeps): Promise<number> => {
  const ctx = await deps.freshSchemaContext(tenantId);
  const jobs = await deps.repository.listJobs(tenantId);
  const now = deps.now();
  let changed = 0;

  for (const screen of searchScreens(ctx)) {
    const signature = recordSearchSignature(screen);
    const jobId = recordSearchBackfillJobId(screen.collection);
    const plan = planRecordSearchBackfill(signature, jobs.get(jobId) ?? null, now);
    if (plan.kind === 'none') continue;
    const updated = await deps.repository.updateJob(tenantId, jobId, (current) => {
      const confirmed = planRecordSearchBackfill(signature, current, now);
      if (confirmed.kind === 'start') {
        return startRecordSearchJob('backfill', [{ collection: screen.collection, fieldKey: null, multi: false, value: null }], signature, current, now);
      }
      return confirmed.kind === 'nudge' && current ? { ...current, touchedAt: now } : null;
    });
    if (updated) changed += 1;
  }

  for (const [jobId, state] of jobs) {
    if (state.kind !== 'propagate' || !isRecordSearchJobStalled(state, now)) continue;
    const updated = await deps.repository.updateJob(tenantId, jobId, (current) =>
      current && isRecordSearchJobStalled(current, now) ? { ...current, touchedAt: now } : null);
    if (updated) changed += 1;
  }

  return changed;
};
