import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { IWorkflowExecutionRepository } from '../../domain/repositories/IWorkflowExecutionRepository';
import type { WorkflowExecution } from '../../domain/entities/Workflow';

/** Um evento abre em leque, mas não indefinidamente: o teto existe para a resposta ser limitada. */
const EXECUTIONS_PER_EVENT_LIMIT = 20;

const asDate = (value: unknown): Date | null =>
  value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : null;

export class FirebaseWorkflowExecutionRepository implements IWorkflowExecutionRepository {
  constructor(private readonly db: Firestore) {}

  async create(execution: WorkflowExecution): Promise<void> {
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
      });
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

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        tenantId,
        workflowDefinitionId: String(data.workflowDefinitionId ?? ''),
        eventId: String(data.eventId ?? ''),
        status: data.status as WorkflowExecution['status'],
        startedAt: asDate(data.startedAt) ?? new Date(0),
        ...(asDate(data.finishedAt) === null ? {} : { finishedAt: asDate(data.finishedAt) as Date }),
        logs: (Array.isArray(data.logs) ? data.logs : []).map((entry: Record<string, unknown>) => ({
          ...entry,
          at: asDate(entry.at) ?? new Date(0),
        })) as WorkflowExecution['logs'],
        outputs: (data.outputs ?? {}) as WorkflowExecution['outputs'],
      };
    });
  }
}
