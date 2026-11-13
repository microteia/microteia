import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import type {
  IWorkflowTaskRepository,
  WorkflowTaskDecision,
  WorkflowTaskDecisionResult,
} from '../../domain/repositories/IWorkflowTaskRepository';
import { WORKFLOW_TASKS_COLLECTION, tallyApprovalVotes, workflowTaskVoters } from '../../domain/schema/workflowTask';
import type { WorkflowTask, WorkflowTaskOutcome, WorkflowTaskStatus, WorkflowTaskVote } from '../../domain/schema/workflowTask';

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

/** Os votos gravados, lidos com desconfiança: o que não tem forma de voto fica de fora. */
const votesOf = (value: unknown): Record<string, WorkflowTaskVote> => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([userId, raw]) => {
    const vote = raw as Record<string, unknown> | null;
    const at = toDate(vote?.at);
    if (!vote || typeof vote.outcome !== 'string' || !at) return [];
    return [[userId, {
      outcome: vote.outcome,
      name: typeof vote.name === 'string' ? vote.name : '',
      at,
      comment: typeof vote.comment === 'string' ? vote.comment : '',
      via: vote.via === 'portal' ? 'portal' : 'member',
    } satisfies WorkflowTaskVote]];
  }));
};

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
    ...(Array.isArray(data.guestIds) ? { guestIds: strings(data.guestIds) } : {}),
    ...(typeof data.quorum === 'number' && data.quorum > 1 ? { quorum: data.quorum } : {}),
    ...(data.votes && typeof data.votes === 'object' ? { votes: votesOf(data.votes) } : {}),
    ...(typeof data.remindEveryDays === 'number' && data.remindEveryDays > 0 ? { remindEveryDays: data.remindEveryDays } : {}),
    ...(data.nextReminderAt !== undefined ? { nextReminderAt: toDate(data.nextReminderAt) } : {}),
    ...(typeof data.reminders === 'number' ? { reminders: data.reminders } : {}),
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
        ...(task.guestIds && task.guestIds.length > 0 ? { guestIds: task.guestIds } : {}),
        ...(task.quorum && task.quorum > 1 ? { quorum: task.quorum, votes: {} } : {}),
        ...(task.remindEveryDays && task.nextReminderAt
          ? { remindEveryDays: task.remindEveryDays, nextReminderAt: Timestamp.fromDate(task.nextReminderAt), reminders: 0 }
          : {}),
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
      if (!workflowTaskVoters(task).includes(decision.userId)) return { ok: false, reason: 'not-assignee' };
      if (!task.outcomes.some((one) => one.key === decision.outcome)) return { ok: false, reason: 'invalid-outcome' };
      if (task.votes?.[decision.userId]) return { ok: false, reason: 'already-voted' };

      const vote: WorkflowTaskVote = {
        outcome: decision.outcome, name: decision.userName, at: decision.at, comment: decision.comment, via: decision.via,
      };
      const votes = { ...(task.votes ?? {}), [decision.userId]: vote };
      const tally = tallyApprovalVotes(task, votes);
      const quorumVote = task.quorum && task.quorum > 1
        ? { [`votes.${decision.userId}`]: { ...vote, at: Timestamp.fromDate(decision.at) } }
        : {};

      if (!tally.closed) {
        tx.update(ref, quorumVote);
        return { ok: true, closed: false, task: { ...task, votes } };
      }
      tx.update(ref, {
        ...quorumVote,
        status: 'decided',
        outcome: tally.outcome,
        decidedBy: decision.userId,
        decidedByName: decision.userName,
        decidedAt: Timestamp.fromDate(decision.at),
        comment: decision.comment,
      });
      return {
        ok: true,
        closed: true,
        task: {
          ...task,
          ...(task.quorum && task.quorum > 1 ? { votes } : {}),
          status: 'decided',
          outcome: tally.outcome,
          decidedBy: decision.userId,
          decidedByName: decision.userName,
          decidedAt: decision.at,
          comment: decision.comment,
        },
      };
    });
  }

  // Uma consulta de grupo, servida pelo índice `status` + `nextReminderAt` (COLLECTION_GROUP): a tarefa sem
  // lembrete não tem o campo, e não entra nela.
  async dueReminders(now: Date, limit: number): Promise<WorkflowTask[]> {
    const snapshot = await this.db.collectionGroup(WORKFLOW_TASKS_COLLECTION)
      .where('status', '==', 'open')
      .where('nextReminderAt', '<=', Timestamp.fromDate(now))
      .orderBy('nextReminderAt', 'asc')
      .limit(limit)
      .get();
    return snapshot.docs.flatMap((doc) => {
      const tenantId = doc.ref.parent.parent?.id;
      return tenantId ? [mapWorkflowTask(tenantId, doc.id, doc.data())] : [];
    });
  }

  async claimReminder(task: WorkflowTask, next: Date | null): Promise<boolean> {
    const ref = this.ref(task.tenantId, task.id);
    return this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists || snapshot.get('status') !== 'open') return false;
      const stored = toDate(snapshot.get('nextReminderAt'));
      if (!stored || !task.nextReminderAt || stored.getTime() !== task.nextReminderAt.getTime()) return false;
      tx.update(ref, {
        nextReminderAt: next ? Timestamp.fromDate(next) : null,
        reminders: (typeof snapshot.get('reminders') === 'number' ? snapshot.get('reminders') : 0) + 1,
      });
      return true;
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
