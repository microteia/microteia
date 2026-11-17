import { collection, doc, getDoc, query, where, orderBy, limit, Timestamp, onSnapshot } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type { IWorkflowExecutionRepository } from '../../domain/repositories/IWorkflowExecutionRepository';
import type { WorkflowExecution, WorkflowExecutionLogEntry } from '../../domain/entities/Workflow';
import {
  EXECUTION_DETAIL_COLLECTION,
  EXECUTION_DETAIL_DOC,
  EXECUTION_HISTORY_SCHEMA,
} from '../../domain/schema/executionHistory';

const EXECUTIONS_LIMIT = 100;

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date));

const stamp = (v: unknown): number => (v instanceof Timestamp ? v.toMillis() : 0);

/**
 * `detail` é o documento das linhas — ou o próprio resumo, no histórico anterior ao `schema`, que tinha
 * tudo num documento só. `null` quando só o resumo foi lido.
 */
const mapExecution = (
  id: string,
  summary: Record<string, unknown>,
  detail: Record<string, unknown> | null,
  tenantId: string,
): WorkflowExecution => ({
  id,
  tenantId,
  workflowDefinitionId: summary.workflowDefinitionId as string,
  eventId: summary.eventId as string,
  status: summary.status as WorkflowExecution['status'],
  startedAt: toDate(summary.startedAt),
  finishedAt: summary.finishedAt ? toDate(summary.finishedAt) : undefined,
  resumeAt: summary.resumeAt ? toDate(summary.resumeAt) : undefined,
  ...(typeof summary.actorId === 'string' ? { actorId: summary.actorId } : {}),
  logs: ((detail?.logs as Record<string, unknown>[]) ?? []).map((entry) => ({
    ...entry,
    at: toDate(entry.at),
  })) as WorkflowExecutionLogEntry[],
  outputs: (detail?.outputs as Record<string, Record<string, unknown>>) ?? {},
  detailAvailable: detail !== null,
});

export class FirebaseWorkflowExecutionRepository implements IWorkflowExecutionRepository {
  subscribeToWorkflowExecutions(
    tenantId: string,
    workflowDefinitionId: string,
    detail: boolean,
    onUpdate: (executions: WorkflowExecution[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const executions = collection(db, 'tenants', tenantId, 'workflow_executions');
    const fail = (error: Error) => {
      console.error('[WorkflowExecutionRepository] subscribeToWorkflowExecutions:', error.message);
      onError?.(error);
    };

    // Sem o detalhe, a consulta precisa dizer `schema == 2`: é o que a regra prova antes de liberar a
    // quem não gerencia automações — sem isso ela alcançaria o histórico antigo e seria recusada inteira.
    if (!detail) {
      const summaries = query(
        executions,
        where('workflowDefinitionId', '==', workflowDefinitionId),
        where('schema', '==', EXECUTION_HISTORY_SCHEMA),
        orderBy('startedAt', 'desc'),
        limit(EXECUTIONS_LIMIT),
      );
      return onSnapshot(
        summaries,
        (snap) => onUpdate(snap.docs.map((d) => mapExecution(d.id, d.data(), null, tenantId))),
        fail,
      );
    }

    /*
     * O detalhe é outro documento, e não há consulta que traga os dois. Ele é lido de novo só quando o
     * resumo muda de estado — a execução que espera é regravada inteira (resumo e detalhe, no mesmo
     * lote) quando continua, e uma encerrada não muda mais. `ticket` descarta a resposta de um retrato
     * que um mais novo já substituiu.
     */
    const details = new Map<string, { key: string; data: DocumentData | null }>();
    let ticket = 0;
    let closed = false;
    const stop = onSnapshot(
      query(
        executions,
        where('workflowDefinitionId', '==', workflowDefinitionId),
        orderBy('startedAt', 'desc'),
        limit(EXECUTIONS_LIMIT),
      ),
      (snap) => {
        const current = ++ticket;
        void Promise.all(snap.docs.map(async (d) => {
          const summary = d.data();
          if (summary.schema !== EXECUTION_HISTORY_SCHEMA) return mapExecution(d.id, summary, summary, tenantId);
          const key = `${String(summary.status)}|${stamp(summary.finishedAt)}|${stamp(summary.resumeAt)}`;
          let cached = details.get(d.id);
          if (cached?.key !== key) {
            const read = await getDoc(doc(d.ref, EXECUTION_DETAIL_COLLECTION, EXECUTION_DETAIL_DOC));
            cached = { key, data: read.exists() ? read.data() : null };
            details.set(d.id, cached);
          }
          return mapExecution(d.id, summary, cached.data, tenantId);
        }))
          .then((mapped) => {
            if (!closed && current === ticket) onUpdate(mapped);
          })
          .catch((error: Error) => {
            if (!closed) fail(error);
          });
      },
      fail,
    );
    return () => {
      closed = true;
      stop();
    };
  }

  async rerunExecution(tenantId: string, executionId: string): Promise<void> {
    const call = httpsCallable<{ tenantId: string; executionId: string }, { eventId: string }>(
      functions,
      'rerunWorkflowExecution',
    );
    await call({ tenantId, executionId });
  }
}
