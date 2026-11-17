import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, DocumentReference, Firestore } from 'firebase-admin/firestore';
import type { IWorkflowExecutionRepository } from '../../domain/repositories/IWorkflowExecutionRepository';
import type { WorkflowExecution } from '../../domain/entities/Workflow';
import { bareHistoryRecord, historyRecord } from '../../domain/services/executionHistory';
import {
  EXECUTION_DETAIL_COLLECTION,
  EXECUTION_DETAIL_DOC,
  EXECUTION_HISTORY_SCHEMA,
} from '../../domain/schema/executionHistory';

/** Um evento abre em leque, mas não indefinidamente: o teto existe para a resposta ser limitada. */
const EXECUTIONS_PER_EVENT_LIMIT = 20;

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

export class FirebaseWorkflowExecutionRepository implements IWorkflowExecutionRepository {
  constructor(private readonly db: Firestore) {}

  private executionRef(tenantId: string, id: string): DocumentReference {
    return this.db.collection('tenants').doc(tenantId).collection('workflow_executions').doc(id);
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
      .collection('workflow_executions')
      .where('eventId', '==', eventId)
      .limit(EXECUTIONS_PER_EVENT_LIMIT)
      .get();

    return Promise.all(snapshot.docs.map((doc) => this.withDetail(tenantId, doc.id, doc.data(), doc.ref)));
  }
}
