import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { grantedPermissions, isOfficeMember } from './shared/requirePermission';
import { identifyActor } from '../workflow/identifyActor';
import { RESUME_CLOCK_ID_PREFIX } from '../../domain/schema/workflowClock';
import { WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS } from '../../domain/schema/workflowBudget';

interface CompleteWorkflowTaskRequest {
  tenantId: string;
  taskId: string;
  outcome: string;
  comment?: string;
}

/** O comentário vai para o histórico e para a saída do passo; um texto sem fim não cabe em nenhum dos dois. */
const MAX_COMMENT_LENGTH = 2000;

/**
 * DECIDE uma tarefa de aprovação e retoma a execução que a esperava — na hora, e não na próxima volta
 * do relógio: quem decidiu espera ver a automação seguir.
 *
 * A ordem é a garantia:
 *
 * 1. a continuação tem de EXISTIR — se o prazo já venceu, o relógio a tomou e a execução seguiu pelo
 *    desfecho de expiração; decidir agora seria escrever uma resposta que ninguém vai ler;
 * 2. a decisão é gravada na tarefa NUMA transação (aberta, designado, desfecho válido) — duas pessoas que
 *    decidem juntas: uma vence;
 * 3. o desfecho entra nas saídas da continuação por outra transação, que só atualiza a continuação que
 *    ainda está lá — gravar por cima de uma que o relógio acabou de tomar a recriaria, e a execução
 *    seguiria duas vezes;
 * 4. a retomada passa pela MESMA porta do relógio (`claim` incluso).
 *
 * Quem decide é quem está na tarefa — não quem tem uma permissão: a aprovação é de uma pessoa, e um
 * administrador que decidisse por ela apagaria justamente o que a aprovação registra.
 */
export const completeWorkflowTask = onCall(
  { region: 'southamerica-east1', cors: true, timeoutSeconds: WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS },
  async (request): Promise<{ status: 'decided' }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }
    const { tenantId, taskId, outcome, comment } = (request.data ?? {}) as CompleteWorkflowTaskRequest;
    if (!tenantId || !taskId || !outcome) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
    }
    if (!(await isOfficeMember(tenantId, request.auth))) {
      throw new HttpsError('permission-denied', '@core.automation/task.refused.not-assignee');
    }

    const di = getDI();
    const tasks = di.getWorkflowTaskRepository();
    const clock = di.getWorkflowClockDeps();
    const now = new Date();

    const task = await tasks.findById(tenantId, taskId);
    if (!task) throw new HttpsError('not-found', '@core.automation/task.refused.not-found');

    const entry = await clock.repository.find(tenantId, `${RESUME_CLOCK_ID_PREFIX}${task.executionId}`);
    if (!entry || entry.kind !== 'resume' || entry.taskId !== taskId) {
      await tasks.expire(tenantId, taskId, now);
      throw new HttpsError('failed-precondition', '@core.automation/task.refused.expired');
    }

    const actor = await identifyActor(request.auth.uid, 'ui', await grantedPermissions(tenantId, request.auth.uid));
    const decision = await tasks.decide(tenantId, taskId, {
      userId: request.auth.uid,
      userName: actor?.name ?? '',
      outcome,
      comment: (comment ?? '').trim().slice(0, MAX_COMMENT_LENGTH),
      at: now,
    });
    if (!decision.ok) {
      throw new HttpsError('failed-precondition', `@core.automation/task.refused.${decision.reason}`);
    }

    const outputs = {
      ...entry.outputs,
      [task.stepId]: {
        ...(entry.outputs[task.stepId] ?? {}),
        outcome: decision.task.outcome ?? outcome,
        decidedBy: decision.task.decidedBy ?? request.auth.uid,
        decidedByName: decision.task.decidedByName ?? '',
        decidedAt: now,
        comment: decision.task.comment ?? '',
        taskId,
      },
    };
    if ((await clock.repository.annotateResume(entry, outputs)) === 'stale') {
      throw new HttpsError('failed-precondition', '@core.automation/task.refused.expired');
    }

    await clock.resume?.({ ...entry, outputs, decided: true });
    return { status: 'decided' };
  },
);
