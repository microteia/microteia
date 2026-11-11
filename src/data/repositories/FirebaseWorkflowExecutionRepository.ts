import { collection, query, where, orderBy, limit, Timestamp, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type { IWorkflowExecutionRepository } from '../../domain/repositories/IWorkflowExecutionRepository';
import type { WorkflowExecution, WorkflowExecutionLogEntry } from '../../domain/entities/Workflow';

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date));

const mapExecution = (id: string, d: Record<string, unknown>, tenantId: string): WorkflowExecution => ({
  id,
  tenantId,
  workflowDefinitionId: d.workflowDefinitionId as string,
  eventId: d.eventId as string,
  status: d.status as WorkflowExecution['status'],
  startedAt: toDate(d.startedAt),
  finishedAt: d.finishedAt ? toDate(d.finishedAt) : undefined,
  resumeAt: d.resumeAt ? toDate(d.resumeAt) : undefined,
  logs: ((d.logs as Record<string, unknown>[]) ?? []).map((entry) => ({
    ...entry,
    at: toDate(entry.at),
  })) as WorkflowExecutionLogEntry[],
  outputs: (d.outputs as Record<string, Record<string, unknown>>) ?? {},
});

export class FirebaseWorkflowExecutionRepository implements IWorkflowExecutionRepository {
  subscribeToWorkflowExecutions(
    tenantId: string,
    workflowDefinitionId: string,
    onUpdate: (executions: WorkflowExecution[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const q = query(
      collection(db, 'tenants', tenantId, 'workflow_executions'),
      where('workflowDefinitionId', '==', workflowDefinitionId),
      orderBy('startedAt', 'desc'),
      limit(100),
    );
    return onSnapshot(
      q,
      (snap) => onUpdate(snap.docs.map((d) => mapExecution(d.id, d.data(), tenantId))),
      (error) => {
        console.error('[WorkflowExecutionRepository] subscribeToWorkflowExecutions:', error.message);
        onError?.(error);
      },
    );
  }

  async rerunExecution(tenantId: string, executionId: string): Promise<void> {
    const call = httpsCallable<{ tenantId: string; executionId: string }, { eventId: string }>(
      functions,
      'rerunWorkflowExecution',
    );
    await call({ tenantId, executionId });
  }
}
