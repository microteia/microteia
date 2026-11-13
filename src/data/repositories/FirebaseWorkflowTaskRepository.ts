import { collection, limit, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type { IWorkflowTaskRepository } from '../../domain/repositories/IWorkflowTaskRepository';
import { WORKFLOW_TASKS_COLLECTION } from '../../domain/schema/workflowTask';
import type { WorkflowTask, WorkflowTaskOutcome } from '../../domain/schema/workflowTask';

/** A caixa mostra as abertas; cem é mais do que uma pessoa decide de uma vez, e a lista não cresce sem fim. */
const MY_TASKS_LIMIT = 100;

const toDate = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : null);

const strings = (value: unknown): string[] =>
  (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

const outcomesOf = (value: unknown): WorkflowTaskOutcome[] =>
  (Array.isArray(value) ? value : [])
    .filter((item): item is WorkflowTaskOutcome =>
      !!item && typeof item === 'object' && typeof item.key === 'string' && typeof item.label === 'string');

const mapTask = (tenantId: string, id: string, data: DocumentData): WorkflowTask => ({
  id,
  tenantId,
  workflowDefinitionId: String(data.workflowDefinitionId ?? ''),
  executionId: String(data.executionId ?? ''),
  stepId: String(data.stepId ?? ''),
  title: String(data.title ?? ''),
  message: String(data.message ?? ''),
  assigneeIds: strings(data.assigneeIds),
  outcomes: outcomesOf(data.outcomes),
  ...(Array.isArray(data.guestIds) ? { guestIds: strings(data.guestIds) } : {}),
  ...(typeof data.quorum === 'number' && data.quorum > 1 ? { quorum: data.quorum } : {}),
  // Só o que a caixa usa de cada voto: quem já votou some da lista dele, e o progresso conta os votos.
  ...(data.votes && typeof data.votes === 'object'
    ? {
        votes: Object.fromEntries(Object.entries(data.votes as Record<string, { outcome?: unknown; name?: unknown; at?: unknown; comment?: unknown; via?: unknown }>)
          .map(([userId, vote]) => [userId, {
            outcome: String(vote?.outcome ?? ''),
            name: String(vote?.name ?? ''),
            at: toDate(vote?.at) ?? new Date(0),
            comment: String(vote?.comment ?? ''),
            via: vote?.via === 'portal' ? 'portal' as const : 'member' as const,
          }])),
      }
    : {}),
  // Só o que a caixa mostra de cada repasse: quem passou a tarefa a quem a recebeu, e por quê.
  ...(Array.isArray(data.delegations)
    ? {
        delegations: (data.delegations as Record<string, unknown>[]).map((one) => ({
          from: String(one?.from ?? ''),
          fromName: String(one?.fromName ?? ''),
          to: String(one?.to ?? ''),
          toName: String(one?.toName ?? ''),
          reason: String(one?.reason ?? ''),
          at: toDate(one?.at) ?? new Date(0),
        })),
      }
    : {}),
  status: data.status === 'decided' || data.status === 'expired' ? data.status : 'open',
  createdAt: toDate(data.createdAt) ?? new Date(0),
  dueAt: toDate(data.dueAt),
  target: data.target && typeof data.target.collection === 'string' && typeof data.target.recordId === 'string'
    ? { collection: data.target.collection, recordId: data.target.recordId }
    : null,
});

export class FirebaseWorkflowTaskRepository implements IWorkflowTaskRepository {
  subscribeToMyOpenTasks(
    tenantId: string,
    userId: string,
    onUpdate: (tasks: WorkflowTask[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const q = query(
      collection(db, 'tenants', tenantId, WORKFLOW_TASKS_COLLECTION),
      where('assigneeIds', 'array-contains', userId),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
      limit(MY_TASKS_LIMIT),
    );
    return onSnapshot(
      q,
      (snapshot) => onUpdate(snapshot.docs.map((doc) => mapTask(tenantId, doc.id, doc.data()))),
      (error) => {
        console.error('[WorkflowTaskRepository] subscribeToMyOpenTasks:', error.message);
        onError?.(error);
      },
    );
  }

  async completeTask(tenantId: string, taskId: string, outcome: string, comment: string): Promise<'decided' | 'voted'> {
    const call = httpsCallable<
      { tenantId: string; taskId: string; outcome: string; comment: string },
      { status: string }
    >(functions, 'completeWorkflowTask');
    const { data } = await call({ tenantId, taskId, outcome, comment });
    return data.status === 'voted' ? 'voted' : 'decided';
  }

  async delegateTask(tenantId: string, taskId: string, toUserId: string, reason: string): Promise<void> {
    const call = httpsCallable<
      { tenantId: string; taskId: string; toUserId: string; reason: string },
      { status: string }
    >(functions, 'delegateWorkflowTask');
    await call({ tenantId, taskId, toUserId, reason });
  }
}
