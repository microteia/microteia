import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { isOfficeMember } from './shared/requirePermission';
import { identifyActor } from '../workflow/identifyActor';
import { MAX_DELEGATION_REASON_LENGTH, WORKFLOW_TASKS_PAGE_KEY } from '../../domain/schema/workflowTask';

interface DelegateWorkflowTaskRequest {
  tenantId: string;
  taskId: string;
  /** O membro que passa a decidir no lugar de quem repassa. */
  toUserId: string;
  reason?: string;
}

/**
 * REPASSA uma tarefa de aprovação: quem está designado (e ainda não votou) a passa a outro membro do
 * escritório — férias, outra área. A troca é na lista de designados, no mesmo lugar (com quórum, a vaga é a
 * mesma), e o repasse fica registrado para sempre. Quem recebe é avisado.
 *
 * Só entre MEMBROS: o convidado do portal decide pelo registro, e repassar para alguém de fora abriria a
 * decisão a quem o escritório nunca convidou. Quem recebe precisa poder entrar no escritório — sem isso, a
 * tarefa iria para uma caixa que ninguém abre.
 */
export const delegateWorkflowTask = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<{ status: 'delegated' }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    const { tenantId, taskId, toUserId, reason } = (request.data ?? {}) as DelegateWorkflowTaskRequest;
    if (!tenantId || !taskId || !toUserId) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
    }
    if (!(await isOfficeMember(tenantId, request.auth))) {
      throw new HttpsError('permission-denied', '@core.automation/task.refused.not-assignee');
    }
    if (!(await isOfficeMember(tenantId, { uid: toUserId, token: {} } as typeof request.auth))) {
      throw new HttpsError('failed-precondition', '@core.automation/task.delegate.not-member');
    }

    const [from, to] = await Promise.all([
      identifyActor(request.auth.uid, 'ui', []),
      identifyActor(toUserId, 'ui', []),
    ]);
    const di = getDI();
    const tasks = di.getWorkflowTaskRepository();
    const delegated = await tasks.delegate(tenantId, taskId, {
      from: request.auth.uid,
      fromName: from?.name ?? '',
      to: toUserId,
      toName: to?.name ?? '',
      reason: (reason ?? '').trim().slice(0, MAX_DELEGATION_REASON_LENGTH),
      at: new Date(),
    });
    if (!delegated.ok) {
      throw new HttpsError(
        delegated.reason === 'not-found' ? 'not-found' : 'failed-precondition',
        `@core.automation/task.delegate.${delegated.reason}`,
      );
    }

    // Quem recebe é avisado como quem é designado — a mesma categoria, a mesma caixa.
    await di.getDispatchNotificationUseCase().execute({
      tenantId,
      source: 'workflow',
      workflowId: delegated.task.workflowDefinitionId,
      executionId: delegated.task.executionId,
      title: delegated.task.title,
      message: '@core.automation/task.delegated.message',
      params: { from: from?.name ?? '', reason: (reason ?? '').trim().slice(0, MAX_DELEGATION_REASON_LENGTH) },
      link: WORKFLOW_TASKS_PAGE_KEY,
      target: null,
      category: 'core.automation/task',
      dedupKey: `${taskId}:delegated:${toUserId}`,
      channels: { audit: false, inApp: true, email: true, push: true },
      recipientIds: [toUserId],
      recipientPermissions: [],
    }).catch((error: unknown) => console.error(`[delegate-task] ${tenantId}/${taskId}:`, error));
    return { status: 'delegated' };
  },
);
