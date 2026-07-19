import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
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
}

interface RunActionResponse {
  outcome: ActionOutcome | null;
  executionId: string | null;
  error: string | null;
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
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const { tenantId, actionId, source, context, recordId, isNew } = request.data as RunActionRequest;

    if (!tenantId) throw new HttpsError('invalid-argument', 'Escritório não informado.');
    if (!actionId) throw new HttpsError('invalid-argument', 'Ação não informada.');

    const di = getDI();
    const role = await di.getTenantMemberRepository().getMemberRole(tenantId, request.auth.uid);
    if (!role) {
      throw new HttpsError('permission-denied', 'Você não é membro deste escritório.');
    }

    const snap = await getDb().doc(`tenants/${tenantId}/actions/${actionId}`).get();
    if (!snap.exists) return failure('Ação não encontrada.');

    const action = snap.data() as { key?: string; title?: string; workflowId?: string; enabled?: boolean };
    if (action.enabled === false) return failure('Esta ação está desativada.');
    if (!action.workflowId) return failure('Esta ação não tem um fluxo de trabalho vinculado.');

    await di.ensureWorkflowStepsRegistered();

    // O contexto vai cru: `formatAndValidateParameters`, dentro do executor, poda e coage os campos
    // contra os `fields` declarados no parâmetro `context` do workflow-alvo.
    const result = await di.getRunCalledWorkflowUseCase().execute({
      tenantId,
      targetWorkflowId: action.workflowId,
      params: {
        action: action.key ?? '',
        source: source ?? '',
        context: context ?? {},
        recordId: recordId ?? null,
        isNew: isNew === true,
      },
      callDepth: 1,
    });

    if (!result.found) {
      return failure('O fluxo de trabalho vinculado não existe, está desativado, ou não é do tipo "Workflow chamado".');
    }

    if (result.status !== 'SUCCESS') {
      return {
        outcome: null,
        executionId: result.executionId,
        error: `A execução de "${action.title ?? action.key ?? 'ação'}" falhou. Consulte as execuções do fluxo para os detalhes.`,
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
        error: 'O fluxo terminou sem devolver "result", "status" ou "actions". O último Step precisa'
          + ' emitir as três chaves de uma vez — use "Montar Objeto" sem nome, ou um Step Script.',
      };
    }

    return {
      outcome: normalizeActionOutcome(outputs),
      executionId: result.executionId,
      error: null,
    };
  },
);
