import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_AUTOMATION_RUN } from '../../domain/schema/access';
import { getDb } from '../firebase/initFirebase';
import { normalizeActionOutcome } from '../../domain/entities/Action';
import type { ActionOutcome } from '../../domain/entities/Action';

interface RunActionRequest {
  tenantId: string;
  actionId: string;
  source: string;
  context: Record<string, unknown>;
  recordId?: string | null;
  isNew: boolean;
  params?: Record<string, unknown>;
}

interface RunActionResponse {
  outcome: ActionOutcome | null;
  executionId: string | null;
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string | null;
  errorParams?: Record<string, string>;
}

const failure = (message: string): RunActionResponse => ({
  outcome: null,
  executionId: null,
  error: message,
});

export const runAction = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<RunActionResponse> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId, actionId, source, context, recordId, isNew, params } = request.data as RunActionRequest;

    if (!tenantId) throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
    if (!actionId) throw new HttpsError('invalid-argument', '@core.automation/handler.action.missing');

    const di = getDI();
    const actorPermissions = await requirePermission(tenantId, request.auth.uid, PERMISSION_AUTOMATION_RUN);

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
      actor: { userId: request.auth.uid, permissions: actorPermissions },
      callDepth: 1,
    });

    if (!result.found) {
      return failure('@core.automation/handler.action.workflow-invalid');
    }

    if (result.status !== 'SUCCESS') {
      return {
        outcome: null,
        executionId: result.executionId,
        error: '@core.automation/handler.action.run-failed',
        errorParams: { name: String(action.title ?? action.key ?? '') },
      };
    }

    // O executor devolve só os outputs do ÚLTIMO step da travessia, e o Step "Saída do Workflow"
    // emite uma chave por vez. Nenhuma das três chaves presentes quase sempre significa que o autor
    // encadeou três Steps de saída — o que descartaria as duas primeiras silenciosamente.
    const outputs = (result.outputs ?? {}) as Record<string, unknown>;
    if (!('result' in outputs) && !('status' in outputs) && !('actions' in outputs)) {
      return {
        outcome: null,
        executionId: result.executionId,
        error: '@core.automation/handler.action.no-result',
      };
    }

    return {
      outcome: normalizeActionOutcome(outputs),
      executionId: result.executionId,
      error: null,
    };
  },
);
