import { normalizeActionOutcome } from '../../domain/entities/Action';
import type { ActionOutcome } from '../../domain/entities/Action';
import type { RunCalledWorkflowResult } from '../../domain/usecases/RunCalledWorkflowUseCase';

export interface RunActionResponse {
  outcome: ActionOutcome | null;
  executionId: string | null;
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string | null;
  errorParams?: Record<string, string>;
}

/**
 * O que o botão lê da execução do fluxo dele.
 *
 * A execução que a porta deixou de fora — a condição do fluxo, o filtro de tela ou de lista — termina
 * `SUCCESS` e sem saída nenhuma, igual à que rodou e não devolveu as três chaves. Ela é separada ANTES
 * da conferência do retorno: a frase de `no-result` manda o autor consertar o último passo, e ali não
 * rodou passo nenhum.
 */
export const actionRunResponse = (result: RunCalledWorkflowResult, actionName: string): RunActionResponse => {
  if (!result.found) {
    return { outcome: null, executionId: null, error: '@core.automation/handler.action.workflow-invalid' };
  }

  if (result.status !== 'SUCCESS') {
    return {
      outcome: null,
      executionId: result.executionId,
      error: '@core.automation/handler.action.run-failed',
      errorParams: { name: actionName },
    };
  }

  if (result.skipped) {
    return {
      outcome: null,
      executionId: result.executionId,
      error: '@core.automation/handler.action.skipped',
      errorParams: { name: actionName },
    };
  }

  // O executor devolve só os outputs do ÚLTIMO step da travessia, e o Step "Saída do Workflow"
  // emite uma chave por vez. Nenhuma das três chaves presentes quase sempre significa que o autor
  // encadeou três Steps de saída — o que descartaria as duas primeiras silenciosamente.
  const outputs = (result.outputs ?? {}) as Record<string, unknown>;
  if (!('result' in outputs) && !('status' in outputs) && !('actions' in outputs)) {
    return { outcome: null, executionId: result.executionId, error: '@core.automation/handler.action.no-result' };
  }

  return { outcome: normalizeActionOutcome(outputs), executionId: result.executionId, error: null };
};
