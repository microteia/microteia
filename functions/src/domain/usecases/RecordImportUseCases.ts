import type { IRecordImportJobRepository, RecordImportJob } from '../repositories/IRecordImportJobRepository';
import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import type { IWorkflowMutationRepository } from '../repositories/IWorkflowMutationRepository';
import type { SchemaContext } from '../schema/pathResolver';
import type { ScopedRecordKeySpec } from '../schema/recordKeys';
import type { CreateAuditLogUseCase } from './CreateAuditLogUseCase';
import type { UpsertSpec } from '../schema/mutationSpec';
import { resolveWritableTable } from '../schema/mutationSpec';
import { resolveEntity, resolveRecordKeys } from '../schema/screenEntity';
import { collectionPermissionId } from '../schema/access/permission';
import { grants, grantsAny } from '../schema/access/memberPermissions';
import { readerSeesRecord, resolveMemberVisibility } from '../schema/memberVisibility';
import {
  RECORD_IMPORT_RETENTION_DAYS,
  recordImportLookupsIssue,
  recordImportParentIssue,
  recordImportRowsIssue,
  recordImportTotalIssue,
  tallyImportResults,
} from '../schema/recordImport';
import type {
  RecordImportLookup,
  RecordImportParent,
  RecordImportRow,
  RecordImportRowResult,
  RecordImportTotals,
} from '../schema/recordImport';
import {
  importLookupKeyId,
  importLookupKeys,
  importParentFieldIssue,
  resolveImportReference,
} from '../schema/recordImportReference';
import {
  importLanes,
  RECORD_IMPORT_CONCURRENCY,
  recordImportAuditEntry,
  runInLanes,
} from '../services/recordImport';

/** Quem importa: a pessoa, com o conjunto de permissões que a porta já conferiu. */
export interface RecordImportActor {
  userId: string;
  name: string;
  photoURL: string;
  permissions: string[];
}

/** O que a gravação de UMA linha devolve — a forma de `runWorkflowUpsert`, sem depender dela. */
export type RecordImportUpsertOutcome =
  | { ok: true; value: { id: string; created: boolean } }
  | { ok: false; error: string; errorParams?: Record<string, string> };

/**
 * A gravação de uma linha, já montada para o ator: casa pela chave `primary`, cobra a permissão da
 * coleção, prende ao pai quando há um e, na simulação, não grava. Quem a monta é a infraestrutura — é
 * ela que conhece o `runWorkflowUpsert` e o contexto de execução.
 */
export type RecordImportUpsert = (
  spec: UpsertSpec,
  options: { dryRun: boolean; parent: RecordImportParent | null },
) => Promise<RecordImportUpsertOutcome>;

export interface RecordImportDeps {
  jobs: IRecordImportJobRepository;
  screenProvider: IScreenDefinitionProvider;
  /** As duas leituras do pai e das colunas por chave: o registro, e de quem é cada reserva. */
  records: Pick<IWorkflowMutationRepository, 'getById' | 'findKeyHolders'>;
  audit: CreateAuditLogUseCase;
  upsertFor: (tenantId: string, actor: RecordImportActor) => Promise<RecordImportUpsert>;
  now?: () => Date;
}

/** A recusa do pedido inteiro — não de uma linha. `error` é uma REFERÊNCIA de mensagem. */
export class RecordImportRefusal extends Error {
  readonly params: Record<string, string>;

  constructor(error: string, params: Record<string, string> = {}) {
    super(error);
    this.name = 'RecordImportRefusal';
    this.params = params;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FILE_NAME_MAX = 200;

/**
 * A tabela de uma importação é uma TELA: a lista de opções tem o seu próprio editor, e `members` nem é
 * gravável. Recusa também quem não pode criar NEM alterar nada nela — antes de ler o arquivo inteiro para
 * descobrir isso linha a linha.
 */
const resolveImportTable = async (
  deps: RecordImportDeps,
  tenantId: string,
  table: string,
  actor: RecordImportActor,
) => {
  const ctx = await deps.screenProvider.getSchemaContext(tenantId);
  const resolved = resolveWritableTable(table, ctx);
  if (!resolved.ok) throw new RecordImportRefusal(resolved.error, resolved.errorParams);
  if (resolved.value.kind !== 'entity') {
    throw new RecordImportRefusal('@core.records/import.error.not-a-screen', { table });
  }
  const collection = resolved.value.physicalCollection;
  const wanted = [collectionPermissionId(collection, 'create'), collectionPermissionId(collection, 'update')];
  if (!grantsAny(actor.permissions, wanted)) {
    throw new RecordImportRefusal('@core.access/permission.denied', { permission: wanted.join(', ') });
  }
  return { ctx, collection };
};

const ownedRunningJob = async (
  deps: RecordImportDeps,
  tenantId: string,
  importId: string,
  actor: RecordImportActor,
): Promise<RecordImportJob> => {
  const job = await deps.jobs.get(tenantId, importId);
  // O job de outra pessoa responde como o que não existe: o id não é segredo, mas o lote dela não é seu.
  if (!job || job.createdBy !== actor.userId) throw new RecordImportRefusal('@core.records/import.error.not-found');
  if (job.status !== 'running') throw new RecordImportRefusal('@core.records/import.error.closed');
  return job;
};

const processed = (totals: RecordImportTotals): number => totals.created + totals.updated + totals.failed;

/**
 * O registro que o membro LÊ: a coleção concede `.read` e a visibilidade por registro o alcança. Tudo o
 * mais — inexistente, de outra pessoa, de coleção fechada — responde igual, para a importação não virar
 * um jeito de descobrir o que existe.
 */
const readableRecord = async (
  deps: RecordImportDeps,
  ctx: SchemaContext,
  tenantId: string,
  collection: string,
  id: string,
  actor: RecordImportActor,
): Promise<boolean> => {
  if (!grants(actor.permissions, collectionPermissionId(collection, 'read'))) return false;
  const record = await deps.records.getById(tenantId, collection, id);
  return record !== null
    && readerSeesRecord(resolveMemberVisibility(ctx, collection), collection, { uid: actor.userId, permissions: actor.permissions }, record);
};

/**
 * O pai da importação feita na aba dele: o campo é uma referência de um id da tabela, e o registro aberto
 * é um que o membro lê. Conferido a cada lote — o pai apagado no meio da importação para as linhas
 * seguintes, em vez de deixá-las presas a um registro que não existe mais.
 */
const checkImportParent = async (
  deps: RecordImportDeps,
  ctx: SchemaContext,
  tenantId: string,
  collection: string,
  parent: RecordImportParent,
  actor: RecordImportActor,
): Promise<void> => {
  const fieldIssue = importParentFieldIssue(ctx, collection, parent.fieldKey);
  if (fieldIssue) throw new RecordImportRefusal(fieldIssue, { field: parent.fieldKey });
  const target = resolveImportReference(ctx, collection, parent.fieldKey);
  if (!target || !(await readableRecord(deps, ctx, tenantId, target.collection, parent.recordId, actor))) {
    throw new RecordImportRefusal('@core.records/import.error.parent-not-found');
  }
};

interface ImportLookupPlan {
  fieldKey: string;
  label: string;
  target: string;
  key: ScopedRecordKeySpec;
}

/**
 * As colunas que procuram pela chave, conferidas contra a declaração: o campo é referência da tabela (e
 * não o do pai, que o servidor preenche), a chave é do alvo e de um campo só, e o membro lê o alvo — sem
 * isso, cada linha seria uma pergunta "este CPF existe?" respondida por quem não pode ver a resposta.
 */
const planImportLookups = (
  ctx: SchemaContext,
  collection: string,
  lookups: readonly RecordImportLookup[],
  parent: RecordImportParent | null,
  actor: RecordImportActor,
): ImportLookupPlan[] => lookups.map((lookup) => {
  const target = lookup.fieldKey === parent?.fieldKey ? null : resolveImportReference(ctx, collection, lookup.fieldKey);
  if (!target) throw new RecordImportRefusal('@core.records/import.error.lookup-field', { field: lookup.fieldKey });
  const key = importLookupKeys(ctx, target.collection).find((candidate) => candidate.name === lookup.key);
  if (!key) throw new RecordImportRefusal('@core.records/import.error.lookup-key', { field: target.label, key: lookup.key });
  const permission = collectionPermissionId(target.collection, 'read');
  if (!grants(actor.permissions, permission)) throw new RecordImportRefusal('@core.access/permission.denied', { permission });
  return { fieldKey: lookup.fieldKey, label: target.label, target: target.collection, key };
});

const lookupCells = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]);

const cellText = (value: unknown): string | null =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : null;

/**
 * Troca, em cada linha, a chave pelo id do registro apontado. Uma leitura de reservas para o lote
 * inteiro, e uma do registro por alvo distinto. A linha com um valor que não acha nada — ou que acha um
 * registro que o membro não vê — é recusada ali, com a linha e o valor, e não chega à gravação.
 */
const resolveLookups = async (
  deps: RecordImportDeps,
  ctx: SchemaContext,
  tenantId: string,
  rows: readonly RecordImportRow[],
  plans: readonly ImportLookupPlan[],
  actor: RecordImportActor,
): Promise<{ rows: RecordImportRow[]; failed: RecordImportRowResult[] }> => {
  if (plans.length === 0) return { rows: [...rows], failed: [] };
  const keyIdOf = (plan: ImportLookupPlan, value: unknown): string | null => {
    const text = cellText(value);
    return text === null ? null : importLookupKeyId(ctx, plan.target, plan.key, text);
  };

  const targetOfKey = new Map<string, string>();
  for (const row of rows) {
    for (const plan of plans) {
      if (!(plan.fieldKey in row.data)) continue;
      for (const value of lookupCells(row.data[plan.fieldKey])) {
        const keyId = keyIdOf(plan, value);
        if (keyId) targetOfKey.set(keyId, plan.target);
      }
    }
  }
  const holders = await deps.records.findKeyHolders(tenantId, [...targetOfKey.keys()]);
  const found = new Map<string, { target: string; recordId: string }>();
  for (const [keyId, recordId] of holders) {
    const target = targetOfKey.get(keyId);
    if (target) found.set(`${target}/${recordId}`, { target, recordId });
  }
  const visible = new Set<string>();
  await Promise.all([...found].map(async ([at, { target, recordId }]) => {
    if (await readableRecord(deps, ctx, tenantId, target, recordId, actor)) visible.add(at);
  }));
  const resolve = (plan: ImportLookupPlan, value: unknown): string | null => {
    const keyId = keyIdOf(plan, value);
    const recordId = keyId ? holders.get(keyId) : undefined;
    return recordId && visible.has(`${plan.target}/${recordId}`) ? recordId : null;
  };

  const resolved: RecordImportRow[] = [];
  const failed: RecordImportRowResult[] = [];
  for (const row of rows) {
    const data = { ...row.data };
    let failure: RecordImportRowResult | null = null;
    for (const plan of plans) {
      if (!(plan.fieldKey in data)) continue;
      const raw = data[plan.fieldKey];
      const ids: string[] = [];
      for (const value of lookupCells(raw)) {
        const recordId = resolve(plan, value);
        if (!recordId) {
          failure = {
            line: row.line,
            status: 'failed',
            error: '@core.records/import.error.reference-not-found',
            errorParams: { field: plan.label, value: cellText(value) ?? '' },
          };
          break;
        }
        ids.push(recordId);
      }
      if (failure) break;
      data[plan.fieldKey] = Array.isArray(raw) ? ids : ids[0];
    }
    if (failure) failed.push(failure);
    else resolved.push({ line: row.line, data });
  }
  return { rows: resolved, failed };
};

export const makeRecordImportUseCases = (deps: RecordImportDeps) => {
  const now = deps.now ?? (() => new Date());

  const start = async (input: {
    tenantId: string;
    table: string;
    fileName: string;
    totalRows: number;
    parent?: RecordImportParent;
    actor: RecordImportActor;
  }): Promise<{ importId: string }> => {
    const totalIssue = recordImportTotalIssue(input.totalRows) ?? recordImportParentIssue(input.parent);
    if (totalIssue) throw new RecordImportRefusal(totalIssue);
    const { ctx, collection } = await resolveImportTable(deps, input.tenantId, input.table, input.actor);
    const parent = input.parent ? { fieldKey: input.parent.fieldKey, recordId: input.parent.recordId } : null;
    if (parent) await checkImportParent(deps, ctx, input.tenantId, collection, parent, input.actor);
    const importId = await deps.jobs.create(input.tenantId, {
      table: input.table,
      collection,
      fileName: String(input.fileName ?? '').trim().slice(0, FILE_NAME_MAX),
      totalRows: input.totalRows,
      createdBy: input.actor.userId,
      parent,
      expiresAt: new Date(now().getTime() + RECORD_IMPORT_RETENTION_DAYS * DAY_MS),
    });
    return { importId };
  };

  /**
   * Um lote de linhas. Na simulação, a tabela e o pai vêm do pedido e nada é gravado nem contado; na
   * execução, os dois são os do JOB — o pedido não troca de tela nem de pai no meio de uma importação — e
   * o lote soma aos totais.
   *
   * A ordem importa: as colunas por chave viram id, e o pai entra em cada linha, ANTES das raias. A
   * chave `primary` de um filho costuma ser (pai, referência), e as raias e o casamento pela chave só a
   * enxergam com os ids no lugar.
   */
  const rows = async (input: {
    tenantId: string;
    table: string;
    importId?: string;
    dryRun: boolean;
    rows: RecordImportRow[];
    parent?: RecordImportParent;
    lookups?: RecordImportLookup[];
    actor: RecordImportActor;
  }): Promise<{ results: RecordImportRowResult[] }> => {
    const batchIssue = recordImportRowsIssue(input.rows)
      ?? recordImportParentIssue(input.parent)
      ?? recordImportLookupsIssue(input.lookups);
    if (batchIssue) throw new RecordImportRefusal(batchIssue);

    const job = input.dryRun
      ? null
      : await ownedRunningJob(deps, input.tenantId, String(input.importId ?? ''), input.actor);
    if (job && processed(job.totals) + input.rows.length > job.totalRows) {
      throw new RecordImportRefusal('@core.records/import.error.too-many-rows');
    }
    const table = job?.table ?? input.table;
    const requested = input.parent ? { fieldKey: input.parent.fieldKey, recordId: input.parent.recordId } : null;
    const parent = job ? job.parent : requested;
    const { ctx, collection } = await resolveImportTable(deps, input.tenantId, table, input.actor);
    if (parent) await checkImportParent(deps, ctx, input.tenantId, collection, parent, input.actor);
    const plans = planImportLookups(ctx, collection, input.lookups ?? [], parent, input.actor);
    const upsert = await deps.upsertFor(input.tenantId, input.actor);

    const looked = await resolveLookups(deps, ctx, input.tenantId, input.rows, plans, input.actor);
    const rows = parent
      ? looked.rows.map((row) => ({ ...row, data: { ...row.data, [parent.fieldKey]: parent.recordId } }))
      : looked.rows;
    const lanes = importLanes(rows, resolveRecordKeys(ctx, collection), collection, ctx.fieldRulePresets);

    const written = await runInLanes(rows, lanes, RECORD_IMPORT_CONCURRENCY, async (row): Promise<RecordImportRowResult> => {
      try {
        const outcome = await upsert({ table, data: row.data }, { dryRun: input.dryRun, parent });
        if (!outcome.ok) {
          return { line: row.line, status: 'failed', error: outcome.error, ...(outcome.errorParams ? { errorParams: outcome.errorParams } : {}) };
        }
        return {
          line: row.line,
          status: outcome.value.created ? 'created' : 'updated',
          ...(outcome.value.id ? { id: outcome.value.id } : {}),
        };
      } catch {
        // Uma falha de infraestrutura numa linha não derruba o lote: as outras já podem ter sido gravadas,
        // e o relatório precisa dizer quais.
        return { line: row.line, status: 'failed', error: '@core.records/import.error.row-failed' };
      }
    });
    const results = [...looked.failed, ...written].sort((left, right) => left.line - right.line);

    if (!input.dryRun) await deps.jobs.addTotals(input.tenantId, String(input.importId), tallyImportResults(results));
    return { results };
  };

  /**
   * Fecha a importação e grava a linha de Auditoria dela — uma só, mesmo que o pedido chegue duas vezes:
   * quem perde a corrida pelo fechamento recebe a recusa de job já fechado.
   */
  const finish = async (input: {
    tenantId: string;
    importId: string;
    cancelled: boolean;
    actor: RecordImportActor;
  }): Promise<{ totals: RecordImportTotals }> => {
    await ownedRunningJob(deps, input.tenantId, input.importId, input.actor);
    const status = input.cancelled ? 'cancelled' : 'finished';
    const closed = await deps.jobs.close(input.tenantId, input.importId, status);
    if (!closed) throw new RecordImportRefusal('@core.records/import.error.closed');

    const ctx = await deps.screenProvider.getSchemaContext(input.tenantId);
    await deps.audit.execute(recordImportAuditEntry({
      tenantId: input.tenantId,
      importId: input.importId,
      collection: closed.collection,
      screenTitle: resolveEntity(ctx, closed.collection)?.labelPlural ?? closed.collection,
      fileName: closed.fileName,
      totalRows: closed.totalRows,
      totals: closed.totals,
      status,
      actor: input.actor,
    }));
    return { totals: closed.totals };
  };

  return { start, rows, finish };
};

export type RecordImportUseCases = ReturnType<typeof makeRecordImportUseCases>;
