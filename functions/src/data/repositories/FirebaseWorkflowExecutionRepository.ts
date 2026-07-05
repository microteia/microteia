import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { IWorkflowExecutionRepository } from '../../domain/repositories/IWorkflowExecutionRepository';
import type { WorkflowExecution } from '../../domain/entities/Workflow';

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
}
