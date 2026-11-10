import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { identifyActor } from '../workflow/identifyActor';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_AUTOMATION_RUN } from '../../domain/schema/access';
import { getDb } from '../firebase/initFirebase';
import { actionRunResponse } from './actionRunResponse';
import type { RunActionResponse } from './actionRunResponse';
import { officeSetting } from '../settings/officeSettings';
import {
  WORKFLOW_ACTION_TIMEOUT_CEILING_SECONDS,
  workflowBudgetProperty,
  workflowDeadlineAt,
} from '../../domain/schema/workflowBudget';

interface RunActionRequest {
  tenantId: string;
  actionId: string;
  source: string;
  context: Record<string, unknown>;
  recordId?: string | null;
  isNew: boolean;
  params?: Record<string, unknown>;
}

const failure = (message: string): RunActionResponse => ({
  outcome: null,
  executionId: null,
  error: message,
});

export const runAction = onCall(
  // O TETO; quanto dele o escritório usa é `automation.budget.actionSeconds`. Ver `workflowBudget.ts`.
  { region: 'southamerica-east1', cors: true, timeoutSeconds: WORKFLOW_ACTION_TIMEOUT_CEILING_SECONDS },
  async (request): Promise<RunActionResponse> => {
    const startedAt = Date.now();
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId, actionId, source, context, recordId, isNew, params } = request.data as RunActionRequest;

    if (!tenantId) throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
    if (!actionId) throw new HttpsError('invalid-argument', '@core.automation/handler.action.missing');

    const di = getDI();
    const actorPermissions = await requirePermission(tenantId, request.auth, PERMISSION_AUTOMATION_RUN);

    const snap = await getDb().doc(`tenants/${tenantId}/actions/${actionId}`).get();
    if (!snap.exists) return failure('@core.automation/handler.action.not-found');

    const action = snap.data() as { key?: string; title?: string; workflowId?: string; enabled?: boolean };
    if (action.enabled === false) return failure('@core.automation/handler.action.disabled');
    if (!action.workflowId) return failure('@core.automation/handler.action.no-workflow');

    await di.ensureWorkflowStepsRegistered();

    // O contexto vai cru: `formatAndValidateParameters`, dentro do executor, poda e coage os campos
    // contra os `fields` declarados no parâmetro `context` do workflow-alvo — o que também descarta
    // qualquer parâmetro informado pelo usuário que o fluxo não declare.
    const result = await di.getRunCalledWorkflowUseCase().execute({
      tenantId,
      targetWorkflowId: action.workflowId,
      params: {
        // Os informados primeiro, de propósito: os cinco do sistema são a última palavra, e um
        // parâmetro chamado `recordId` vindo da tela não passa a mandar em qual registro age.
        ...(params ?? {}),
        action: action.key ?? '',
        source: source ?? '',
        context: context ?? {},
        recordId: recordId ?? null,
        isNew: isNew === true,
      },
      actor: await identifyActor(request.auth.uid, 'ui', actorPermissions),
      callDepth: 1,
      deadlineAt: workflowDeadlineAt('action', startedAt, await officeSetting(tenantId, workflowBudgetProperty('action'))),
    });

    return actionRunResponse(result, String(action.title ?? action.key ?? ''));
  },
);
