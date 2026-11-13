import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { grantedPermissions, isOfficeMember } from './shared/requirePermission';
import { identifyActor } from '../workflow/identifyActor';
import { decideWorkflowTask } from '../workflow/decideWorkflowTask';
import { WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS } from '../../domain/schema/workflowBudget';

interface CompleteWorkflowTaskRequest {
  tenantId: string;
  taskId: string;
  outcome: string;
  comment?: string;
}

/**
 * A porta da CAIXA para decidir uma tarefa de aprovação — a decisão em si é `decideWorkflowTask`, a mesma
 * do MCP.
 *
 * Quem decide é quem está na tarefa — não quem tem uma permissão: a aprovação é de uma pessoa, e um
 * administrador que decidisse por ela apagaria justamente o que a aprovação registra.
 */
export const completeWorkflowTask = onCall(
  { region: 'southamerica-east1', cors: true, timeoutSeconds: WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS },
  async (request): Promise<{ status: 'decided' | 'voted' }> => {
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

    const actor = await identifyActor(request.auth.uid, 'ui', await grantedPermissions(tenantId, request.auth.uid));
    const decided = await decideWorkflowTask({
      tenantId,
      taskId,
      outcome,
      ...(comment !== undefined ? { comment } : {}),
      userId: request.auth.uid,
      userName: actor?.name ?? '',
    });
    if (!decided.ok) throw new HttpsError(decided.code, decided.error);
    // `voted`: o voto contou, e a tarefa segue aberta até o quórum.
    return { status: decided.pending ? 'voted' : 'decided' };
  },
);
