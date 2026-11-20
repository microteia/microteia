import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, DocumentReference, Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { IWorkflowExecutionRepository } from '../../domain/repositories/IWorkflowExecutionRepository';
import type { IExecutionHistoryRetention, ExecutionHistoryPurge } from '../../domain/repositories/IExecutionHistoryRetention';
import type { WorkflowExecution } from '../../domain/entities/Workflow';
import {
  bareHistoryRecord,
  historyRecord,
  historyStartedBefore,
  isHistoryExpired,
} from '../../domain/services/executionHistory';
import {
  EXECUTION_DETAIL_COLLECTION,
  EXECUTION_DETAIL_DOC,
  EXECUTION_HISTORY_SCHEMA,
} from '../../domain/schema/executionHistory';

/** Um evento abre em leque, mas não indefinidamente: o teto existe para a resposta ser limitada. */
const EXECUTIONS_PER_EVENT_LIMIT = 20;

const EXECUTIONS_COLLECTION = 'workflow_executions';

/**
 * Execuções apagadas por lote da varredura: duas exclusões cada (resumo e detalhe), abaixo das 500
 * operações que um lote do Firestore aceita.
 */
const PURGE_PAGE_SIZE = 200;

/** A consulta é de GRUPO: só apaga o que estiver no lugar do histórico, e nunca um homônimo. */
const TENANT_EXECUTION_PATH = new RegExp(`^tenants/[^/]+/${EXECUTIONS_COLLECTION}/[^/]+$`);

/** Código gRPC com que o Firestore recusa um documento acima de 1 MiB. */
const FIRESTORE_INVALID_ARGUMENT = 3;

const asDate = (value: unknown): Date | null =>
  value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : null;

/**
 * O resumo e, quando há, o detalhe. O histórico anterior ao `schema` guardava tudo no resumo — por isso
 * as linhas são lidas do detalhe quando ele existe e do próprio resumo quando não.
 */
const mapExecution = (tenantId: string, id: string, summary: DocumentData, detail: DocumentData | undefined): WorkflowExecution => {
  const source = detail ?? summary;
  return {
    id,
    tenantId,
    workflowDefinitionId: String(summary.workflowDefinitionId ?? ''),
    eventId: String(summary.eventId ?? ''),
    status: summary.status as WorkflowExecution['status'],
    startedAt: asDate(summary.startedAt) ?? new Date(0),
    ...(asDate(summary.finishedAt) === null ? {} : { finishedAt: asDate(summary.finishedAt) as Date }),
    ...(asDate(summary.resumeAt) === null ? {} : { resumeAt: asDate(summary.resumeAt) as Date }),
    ...(typeof summary.actorId === 'string' ? { actorId: summary.actorId } : {}),
    logs: (Array.isArray(source.logs) ? source.logs : []).map((entry: Record<string, unknown>) => ({
      ...entry,
      at: asDate(entry.at) ?? new Date(0),
    })) as WorkflowExecution['logs'],
    outputs: (source.outputs ?? {}) as WorkflowExecution['outputs'],
  };
};

export class FirebaseWorkflowExecutionRepository implements IWorkflowExecutionRepository, IExecutionHistoryRetention {
  constructor(private readonly db: Firestore) {}

  private executionRef(tenantId: string, id: string): DocumentReference {
    return this.db.collection('tenants').doc(tenantId).collection(EXECUTIONS_COLLECTION).doc(id);
  }

  private detailRef(summary: DocumentReference): DocumentReference {
    return summary.collection(EXECUTION_DETAIL_COLLECTION).doc(EXECUTION_DETAIL_DOC);
  }

  async create(execution: WorkflowExecution): Promise<void> {
    try {
      await this.write(historyRecord(execution));
    } catch (error) {
      // INVALID_ARGUMENT é o documento acima do teto, que a estimativa por JSON deixou passar. Só esse
      // erro cai para as mensagens: um erro de rede gravaria a versão pobre de um histórico que cabia.
      if ((error as { code?: unknown }).code !== FIRESTORE_INVALID_ARGUMENT) throw error;
      await this.write(bareHistoryRecord(execution));
    }
  }

  async markRunning(execution: WorkflowExecution): Promise<void> {
    await this.executionRef(execution.tenantId, execution.id).set({
      schema: EXECUTION_HISTORY_SCHEMA,
      workflowDefinitionId: execution.workflowDefinitionId,
      eventId: execution.eventId,
      status: 'RUNNING',
      startedAt: Timestamp.fromDate(execution.startedAt),
      finishedAt: null,
      resumeAt: null,
      actorId: execution.actorId ?? null,
    });
  }

  /**
   * Os dois num lote: um resumo sem detalhe mostraria a quem gerencia uma execução sem passo nenhum, e
   * um detalhe sem resumo não seria achado por consulta alguma.
   */
  private async write(execution: WorkflowExecution): Promise<void> {
    const summary = this.executionRef(execution.tenantId, execution.id);
    const batch = this.db.batch();
    batch.set(summary, {
      schema: EXECUTION_HISTORY_SCHEMA,
      workflowDefinitionId: execution.workflowDefinitionId,
      eventId: execution.eventId,
      status: execution.status,
      startedAt: Timestamp.fromDate(execution.startedAt),
      finishedAt: execution.finishedAt ? Timestamp.fromDate(execution.finishedAt) : null,
      resumeAt: execution.resumeAt ? Timestamp.fromDate(execution.resumeAt) : null,
      actorId: execution.actorId ?? null,
    });
    batch.set(this.detailRef(summary), {
      logs: execution.logs.map((entry) => ({
        ...entry,
        at: Timestamp.fromDate(entry.at),
      })),
      outputs: execution.outputs,
    });
    await batch.commit();
  }

  private async withDetail(tenantId: string, id: string, summary: DocumentData, ref: DocumentReference): Promise<WorkflowExecution> {
    const detail = summary.schema === EXECUTION_HISTORY_SCHEMA ? await this.detailRef(ref).get() : null;
    return mapExecution(tenantId, id, summary, detail?.exists ? detail.data() : undefined);
  }

  async findById(tenantId: string, id: string): Promise<WorkflowExecution | null> {
    const ref = this.executionRef(tenantId, id);
    const snapshot = await ref.get();
    return snapshot.exists ? this.withDetail(tenantId, snapshot.id, snapshot.data() as DocumentData, ref) : null;
  }

  // Igualdade única com `limit`: é servida pelo índice de campo único que toda coleção ganha de
  // graça, então não há índice composto a declarar.
  async findByEventId(tenantId: string, eventId: string): Promise<WorkflowExecution[]> {
    const snapshot = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection(EXECUTIONS_COLLECTION)
      .where('eventId', '==', eventId)
      .limit(EXECUTIONS_PER_EVENT_LIMIT)
      .get();

    return Promise.all(snapshot.docs.map((doc) => this.withDetail(tenantId, doc.id, doc.data(), doc.ref)));
  }

  /**
   * Página a página pelo começo, o mais antigo primeiro. A consulta alcança tudo o que pode ter vencido
   * (o começo é a menor das datas que contam); a execução que começou há muito e ainda espera é lida e
   * deixada, e o cursor passa por ela. O histórico anterior ao `schema` não tem detalhe — apagar o que
   * não existe não custa nada no lote.
   */
  async purgeExpired(now: Date, hasTime: () => boolean): Promise<ExecutionHistoryPurge> {
    const startedBefore = Timestamp.fromDate(historyStartedBefore(now));
    let cursor: QueryDocumentSnapshot | undefined;
    let deleted = 0;
    while (hasTime()) {
      const base = this.db
        .collectionGroup(EXECUTIONS_COLLECTION)
        .where('startedAt', '<=', startedBefore)
        .orderBy('startedAt')
        .limit(PURGE_PAGE_SIZE);
      const page = await (cursor ? base.startAfter(cursor) : base).get();
      const expired = page.docs.filter((doc) => {
        const data = doc.data();
        const startedAt = asDate(data.startedAt);
        return TENANT_EXECUTION_PATH.test(doc.ref.path)
          && startedAt !== null
          && isHistoryExpired({
            startedAt,
            finishedAt: asDate(data.finishedAt) ?? undefined,
            resumeAt: asDate(data.resumeAt) ?? undefined,
          }, now);
      });
      if (expired.length > 0) {
        const batch = this.db.batch();
        for (const doc of expired) {
          batch.delete(this.detailRef(doc.ref));
          batch.delete(doc.ref);
        }
        await batch.commit();
        deleted += expired.length;
      }
      if (page.docs.length < PURGE_PAGE_SIZE) return { deleted, complete: true };
      cursor = page.docs[page.docs.length - 1];
    }
    return { deleted, complete: false };
  }

  /**
   * Cada execução no seu lote, com a hora da última gravação como condição: a que a function terminou
   * de gravar depois da consulta faz o lote falhar, e fica com o desfecho de verdade. O detalhe é
   * escrito inteiro porque a execução `RUNNING` nunca teve um — as linhas só existiam na instância.
   */
  async closeAbandoned(startedBefore: Date, now: Date, message: string, limit: number): Promise<number> {
    const page = await this.db
      .collectionGroup(EXECUTIONS_COLLECTION)
      .where('status', '==', 'RUNNING')
      .where('startedAt', '<=', Timestamp.fromDate(startedBefore))
      .orderBy('startedAt')
      .limit(limit)
      .get();
    const at = Timestamp.fromDate(now);
    const outcomes = await Promise.allSettled(
      page.docs
        .filter((doc) => TENANT_EXECUTION_PATH.test(doc.ref.path))
        .map(async (doc) => {
          const batch = this.db.batch();
          batch.update(doc.ref, { status: 'FAILED', finishedAt: at }, { lastUpdateTime: doc.updateTime });
          batch.set(this.detailRef(doc.ref), { logs: [{ level: 'ERROR', message, at }], outputs: {} });
          await batch.commit();
        }),
    );
    return outcomes.filter((outcome) => outcome.status === 'fulfilled').length;
  }
}
