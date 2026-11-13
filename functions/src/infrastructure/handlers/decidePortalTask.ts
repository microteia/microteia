import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { decideWorkflowTask } from '../workflow/decideWorkflowTask';
import { makeResolvePortalGuestsUseCase } from '../../domain/usecases/ResolvePortalGuestsUseCase';
import { WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS } from '../../domain/schema/workflowBudget';

interface DecidePortalTaskRequest {
  tenantId: string;
  taskId: string;
  outcome: string;
  comment?: string;
}

/**
 * A porta do PORTAL para decidir uma tarefa de aprovação — a decisão em si é `decideWorkflowTask`, a mesma
 * da caixa dos membros e do MCP.
 *
 * O convidado não é membro: `completeWorkflowTask` o recusa antes de tudo. Aqui a pergunta é a do portal,
 * em três camadas, todas pelo servidor:
 * 1. o convite está ATIVO (existe e não está suspenso);
 * 2. ele está entre os convidados DESTA tarefa (`guestIds`, gravados quando ela nasceu);
 * 3. ele ainda VÊ o registro agora — o acesso revogado depois do pedido não decide nada, e "não é designado"
 *    vale também para quem perdeu a visão do registro (dizer outra coisa contaria que a tarefa existe).
 */
export const decidePortalTask = onCall(
  { region: 'southamerica-east1', cors: true, timeoutSeconds: WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS },
  async (request): Promise<{ status: 'decided' | 'voted' }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    const { tenantId, taskId, outcome, comment } = (request.data ?? {}) as DecidePortalTaskRequest;
    if (!tenantId || !taskId || !outcome) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
    }
    const userId = request.auth.uid;
    const di = getDI();
    const portal = di.getPortalRepository();
    const guest = await portal.getPortalUser(tenantId, userId);
    if (!guest || guest.suspended) throw new HttpsError('permission-denied', '@core.automation/task.refused.not-assignee');

    const task = await di.getWorkflowTaskRepository().findById(tenantId, taskId);
    if (!task || !(task.guestIds ?? []).includes(userId) || !task.target) {
      throw new HttpsError('permission-denied', '@core.automation/task.refused.not-assignee');
    }
    const seen = await makeResolvePortalGuestsUseCase(portal).execute(tenantId, task.target);
    if (!seen.guests.some((one) => one.userId === userId)) {
      throw new HttpsError('permission-denied', '@core.automation/task.refused.not-assignee');
    }

    const decided = await decideWorkflowTask({
      tenantId,
      taskId,
      outcome,
      ...(comment !== undefined ? { comment } : {}),
      userId,
      userName: guest.displayName || guest.email,
      via: 'portal',
    });
    if (!decided.ok) throw new HttpsError(decided.code, decided.error);
    return { status: decided.pending ? 'voted' : 'decided' };
  },
);
