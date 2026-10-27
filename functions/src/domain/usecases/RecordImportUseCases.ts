import type { IRecordImportJobRepository, RecordImportJob } from '../repositories/IRecordImportJobRepository';
import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import type { CreateAuditLogUseCase } from './CreateAuditLogUseCase';
import type { UpsertSpec } from '../schema/mutationSpec';
import { resolveWritableTable } from '../schema/mutationSpec';
import { resolveEntity, resolveEntityKeys } from '../schema/screenEntity';
import { collectionPermissionId } from '../schema/access/permission';
import { grantsAny } from '../schema/access/memberPermissions';
import {
  RECORD_IMPORT_RETENTION_DAYS,
  recordImportRowsIssue,
  recordImportTotalIssue,
  tallyImportResults,
} from '../schema/recordImport';
import type {
  RecordImportRow,
  RecordImportRowResult,
  RecordImportTotals,
} from '../schema/recordImport';
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
 * coleção e, na simulação, não grava. Quem a monta é a infraestrutura — é ela que conhece o
 * `runWorkflowUpsert` e o contexto de execução.
 */
export type RecordImportUpsert = (spec: UpsertSpec, dryRun: boolean) => Promise<RecordImportUpsertOutcome>;

export interface RecordImportDeps {
  jobs: IRecordImportJobRepository;
  screenProvider: IScreenDefinitionProvider;
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

export const makeRecordImportUseCases = (deps: RecordImportDeps) => {
  const now = deps.now ?? (() => new Date());

  const start = async (input: {
    tenantId: string;
    table: string;
    fileName: string;
    totalRows: number;
    actor: RecordImportActor;
  }): Promise<{ importId: string }> => {
    const totalIssue = recordImportTotalIssue(input.totalRows);
    if (totalIssue) throw new RecordImportRefusal(totalIssue);
    const { collection } = await resolveImportTable(deps, input.tenantId, input.table, input.actor);
    const importId = await deps.jobs.create(input.tenantId, {
      table: input.table,
      collection,
      fileName: String(input.fileName ?? '').trim().slice(0, FILE_NAME_MAX),
      totalRows: input.totalRows,
      createdBy: input.actor.userId,
      expiresAt: new Date(now().getTime() + RECORD_IMPORT_RETENTION_DAYS * DAY_MS),
    });
    return { importId };
  };

  /**
   * Um lote de linhas. Na simulação, a tabela vem do pedido e nada é gravado nem contado; na execução, a
   * tabela é a do JOB — o pedido não troca de tela no meio de uma importação — e o lote soma aos totais.
   */
  const rows = async (input: {
    tenantId: string;
    table: string;
    importId?: string;
    dryRun: boolean;
    rows: RecordImportRow[];
    actor: RecordImportActor;
  }): Promise<{ results: RecordImportRowResult[] }> => {
    const batchIssue = recordImportRowsIssue(input.rows);
    if (batchIssue) throw new RecordImportRefusal(batchIssue);

    let table = input.table;
    if (!input.dryRun) {
      const job = await ownedRunningJob(deps, input.tenantId, String(input.importId ?? ''), input.actor);
      if (processed(job.totals) + input.rows.length > job.totalRows) {
        throw new RecordImportRefusal('@core.records/import.error.too-many-rows');
      }
      table = job.table;
    }
    const { ctx, collection } = await resolveImportTable(deps, input.tenantId, table, input.actor);
    const upsert = await deps.upsertFor(input.tenantId, input.actor);
    const lanes = importLanes(input.rows, resolveEntityKeys(ctx, collection), collection, ctx.fieldRulePresets);

    const results = await runInLanes(input.rows, lanes, RECORD_IMPORT_CONCURRENCY, async (row): Promise<RecordImportRowResult> => {
      try {
        const outcome = await upsert({ table, data: row.data }, input.dryRun);
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
