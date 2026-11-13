import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import type {
  IWorkflowTaskRepository,
  WorkflowTaskDecision,
  WorkflowTaskDecisionResult,
} from '../../domain/repositories/IWorkflowTaskRepository';
import { WORKFLOW_TASKS_COLLECTION } from '../../domain/schema/workflowTask';
import type { WorkflowTask, WorkflowTaskOutcome, WorkflowTaskStatus } from '../../domain/schema/workflowTask';

const toDate = (value: unknown): Date | null => {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
};

const strings = (value: unknown): string[] =>
  (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

const outcomesOf = (value: unknown): WorkflowTaskOutcome[] =>
  (Array.isArray(value) ? value : [])
    .filter((item): item is { key: string; label: string } =>
      !!item && typeof item === 'object' && typeof item.key === 'string' && typeof item.label === 'string')
    .map((item) => ({ key: item.key, label: item.label }));

const STATUSES: readonly WorkflowTaskStatus[] = ['open', 'decided', 'expired'];

export const mapWorkflowTask = (tenantId: string, id: string, data: DocumentData): WorkflowTask => {
  const target = data.target && typeof data.target === 'object'
    && typeof data.target.collection === 'string' && typeof data.target.recordId === 'string'
    ? { collection: data.target.collection as string, recordId: data.target.recordId as string }
    : null;
  return {
    id,
    tenantId,
    workflowDefinitionId: String(data.workflowDefinitionId ?? ''),
    executionId: String(data.executionId ?? ''),
    stepId: String(data.stepId ?? ''),
    title: String(data.title ?? ''),
    message: String(data.message ?? ''),
    assigneeIds: strings(data.assigneeIds),
    outcomes: outcomesOf(data.outcomes),
    status: STATUSES.includes(data.status) ? data.status : 'open',
    createdAt: toDate(data.createdAt) ?? new Date(0),
    dueAt: toDate(data.dueAt),
    target,
    ...(typeof data.outcome === 'string' ? { outcome: data.outcome } : {}),
    ...(typeof data.decidedBy === 'string' ? { decidedBy: data.decidedBy } : {}),
    ...(typeof data.decidedByName === 'string' ? { decidedByName: data.decidedByName } : {}),
    ...(toDate(data.decidedAt) ? { decidedAt: toDate(data.decidedAt) as Date } : {}),
    ...(typeof data.comment === 'string' ? { comment: data.comment } : {}),
  };
};

export class FirestoreWorkflowTaskRepository implements IWorkflowTaskRepository {
  constructor(private readonly db: Firestore) {}

  private ref(tenantId: string, taskId: string) {
    return this.db.collection('tenants').doc(tenantId).collection(WORKFLOW_TASKS_COLLECTION).doc(taskId);
  }

  async createIfAbsent(task: WorkflowTask): Promise<void> {
    const ref = this.ref(task.tenantId, task.id);
    await this.db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) return;
      tx.create(ref, {
        workflowDefinitionId: task.workflowDefinitionId,
        executionId: task.executionId,
        stepId: task.stepId,
        title: task.title,
        message: task.message,
        assigneeIds: task.assigneeIds,
        outcomes: task.outcomes,
        status: task.status,
        createdAt: Timestamp.fromDate(task.createdAt),
        dueAt: task.dueAt ? Timestamp.fromDate(task.dueAt) : null,
        target: task.target,
      });
    });
  }

  async findById(tenantId: string, taskId: string): Promise<WorkflowTask | null> {
    const snapshot = await this.ref(tenantId, taskId).get();
    return snapshot.exists ? mapWorkflowTask(tenantId, taskId, snapshot.data() as DocumentData) : null;
  }

  // A MESMA consulta da caixa na tela, servida pelo mesmo índice (`assigneeIds` + `status` + `createdAt`).
  async listOpenForAssignee(tenantId: string, userId: string, limit: number): Promise<WorkflowTask[]> {
    const snapshot = await this.db.collection('tenants').doc(tenantId).collection(WORKFLOW_TASKS_COLLECTION)
      .where('assigneeIds', 'array-contains', userId)
      .where('status', '==', 'open')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => mapWorkflowTask(tenantId, doc.id, doc.data()));
  }

  async decide(tenantId: string, taskId: string, decision: WorkflowTaskDecision): Promise<WorkflowTaskDecisionResult> {
    const ref = this.ref(tenantId, taskId);
    return this.db.runTransaction(async (tx): Promise<WorkflowTaskDecisionResult> => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) return { ok: false, reason: 'not-found' };
      const task = mapWorkflowTask(tenantId, taskId, snapshot.data() as DocumentData);
      if (task.status !== 'open') return { ok: false, reason: 'not-open' };
      if (!task.assigneeIds.includes(decision.userId)) return { ok: false, reason: 'not-assignee' };
      if (!task.outcomes.some((one) => one.key === decision.outcome)) return { ok: false, reason: 'invalid-outcome' };

      tx.update(ref, {
        status: 'decided',
        outcome: decision.outcome,
        decidedBy: decision.userId,
        decidedByName: decision.userName,
        decidedAt: Timestamp.fromDate(decision.at),
        comment: decision.comment,
      });
      return {
        ok: true,
        task: {
          ...task,
          status: 'decided',
          outcome: decision.outcome,
          decidedBy: decision.userId,
          decidedByName: decision.userName,
          decidedAt: decision.at,
          comment: decision.comment,
        },
      };
    });
  }

  async expire(tenantId: string, taskId: string, at: Date): Promise<void> {
    const ref = this.ref(tenantId, taskId);
    await this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists || snapshot.get('status') !== 'open') return;
      tx.update(ref, { status: 'expired', expiredAt: Timestamp.fromDate(at) });
    });
  }
}
