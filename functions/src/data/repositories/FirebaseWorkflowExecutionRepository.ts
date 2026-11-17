import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import type { IWorkflowExecutionRepository } from '../../domain/repositories/IWorkflowExecutionRepository';
import type { WorkflowExecution } from '../../domain/entities/Workflow';
import { bareHistoryRecord, historyRecord } from '../../domain/services/executionHistory';

/** Um evento abre em leque, mas não indefinidamente: o teto existe para a resposta ser limitada. */
const EXECUTIONS_PER_EVENT_LIMIT = 20;

/** Código gRPC com que o Firestore recusa um documento acima de 1 MiB. */
const FIRESTORE_INVALID_ARGUMENT = 3;

const asDate = (value: unknown): Date | null =>
  value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : null;

const mapExecution = (tenantId: string, id: string, data: DocumentData): WorkflowExecution => ({
  id,
  tenantId,
  workflowDefinitionId: String(data.workflowDefinitionId ?? ''),
  eventId: String(data.eventId ?? ''),
  status: data.status as WorkflowExecution['status'],
  startedAt: asDate(data.startedAt) ?? new Date(0),
  ...(asDate(data.finishedAt) === null ? {} : { finishedAt: asDate(data.finishedAt) as Date }),
  ...(asDate(data.resumeAt) === null ? {} : { resumeAt: asDate(data.resumeAt) as Date }),
  logs: (Array.isArray(data.logs) ? data.logs : []).map((entry: Record<string, unknown>) => ({
    ...entry,
    at: asDate(entry.at) ?? new Date(0),
  })) as WorkflowExecution['logs'],
  outputs: (data.outputs ?? {}) as WorkflowExecution['outputs'],
});

export class FirebaseWorkflowExecutionRepository implements IWorkflowExecutionRepository {
  constructor(private readonly db: Firestore) {}

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

  private async write(execution: WorkflowExecution): Promise<void> {
    await this.db
      .collection('tenants')
      .doc(execution.tenantId)
      .collection('workflow_executions')
      .doc(execution.id)
      .set({
        workflowDefinitionId: execution.workflowDefinitionId,
        eventId: execution.eventId,
        status: execution.status,
        startedAt: Timestamp.fromDate(execution.startedAt),
        finishedAt: execution.finishedAt ? Timestamp.fromDate(execution.finishedAt) : null,
        logs: execution.logs.map((entry) => ({
          ...entry,
          at: Timestamp.fromDate(entry.at),
        })),
        outputs: execution.outputs,
        resumeAt: execution.resumeAt ? Timestamp.fromDate(execution.resumeAt) : null,
      });
  }

  async findById(tenantId: string, id: string): Promise<WorkflowExecution | null> {
    const snapshot = await this.db.collection('tenants').doc(tenantId).collection('workflow_executions').doc(id).get();
    return snapshot.exists ? mapExecution(tenantId, snapshot.id, snapshot.data() as DocumentData) : null;
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

    return snapshot.docs.map((doc) => mapExecution(tenantId, doc.id, doc.data()));
  }
}
