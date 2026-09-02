import type { WorkflowEvent, WorkflowExecutionStatus } from '../entities/Workflow';
import type { WorkflowContext } from '../entities/WorkflowContext';
import type { WorkflowServices } from '../entities/WorkflowContext';
import type { IWorkflowDefinitionRepository } from '../repositories/IWorkflowDefinitionRepository';
import type { IWorkflowExecutionRepository } from '../repositories/IWorkflowExecutionRepository';
import type { StepRegistry } from '../engine/StepRegistry';
import { WorkflowContextHydrator } from '../engine/WorkflowContextHydrator';
import { hydrateAndRunWorkflow } from '../engine/hydrateAndRunWorkflow';
import { WORKFLOW_CALLED_EVENT } from '../schema/eventCatalog';

export interface RunCalledWorkflowParams {
  tenantId: string;
  targetWorkflowId: string;
  params: Record<string, unknown>;
  callDepth: number;
  /** Quem apertou o botão. Ausente na automação que nasce de um gatilho. */
  actor?: WorkflowContext['actor'];
}

/**
 * As linhas de ERRO da execução chamada, do jeito que ela as gravou — referência e parâmetros.
 *
 * Elas sobem porque a única coisa que o chamador sabia dizer era o STATUS, e "terminou com status
 * FAILED" não diz o que houve nem em qual passo: quem lia o log do chamador tinha de sair da tela,
 * achar a automação chamada e procurar a execução correspondente pelo horário. O motivo mora numa
 * execução, a pergunta nasce na outra, e é o chamador que junta as duas.
 */
export interface CalledWorkflowFailure {
  message: string;
  messageParams?: Record<string, string>;
}

export type RunCalledWorkflowResult =
  | { found: false }
  | {
      found: true;
      status: WorkflowExecutionStatus;
      outputs: Record<string, unknown>;
      executionId: string;
      failures: CalledWorkflowFailure[];
    };

export type RunCalledWorkflowUseCase = {
  execute: (params: RunCalledWorkflowParams) => Promise<RunCalledWorkflowResult>;
};

export const makeRunCalledWorkflowUseCase = (
  definitionRepository: IWorkflowDefinitionRepository,
  executionRepository: IWorkflowExecutionRepository,
  registry: StepRegistry,
  services: WorkflowServices,
  hydrator: WorkflowContextHydrator,
): RunCalledWorkflowUseCase => ({
  execute: async ({ tenantId, targetWorkflowId, params, callDepth, actor }) => {
    const target = await definitionRepository.findByRef(tenantId, targetWorkflowId);
    if (!target || !target.enabled || target.eventName !== WORKFLOW_CALLED_EVENT) {
      return { found: false };
    }

    const event: WorkflowEvent = {
      id: crypto.randomUUID(),
      tenantId,
      name: WORKFLOW_CALLED_EVENT,
      payload: { __targetWorkflowId: targetWorkflowId, __callDepth: callDepth, ...params },
      timestamp: services.now(),
    };

    const execution = await hydrateAndRunWorkflow(target, event, { registry, services, hydrator, ...(actor ? { actor } : {}) });
    await executionRepository.create(execution);

    const failures = execution.logs
      .filter((entry) => entry.level === 'ERROR')
      .map((entry) => ({
        message: entry.message,
        ...(entry.messageParams ? { messageParams: entry.messageParams } : {}),
      }));

    return { found: true, status: execution.status, outputs: execution.outputs, executionId: execution.id, failures };
  },
});
