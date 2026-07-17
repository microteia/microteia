import type { WorkflowEvent, WorkflowExecutionStatus } from '../entities/Workflow';
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
}

export type RunCalledWorkflowResult =
  | { found: false }
  | { found: true; status: WorkflowExecutionStatus; outputs: Record<string, unknown>; executionId: string };

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
  execute: async ({ tenantId, targetWorkflowId, params, callDepth }) => {
    const target = await definitionRepository.findById(tenantId, targetWorkflowId);
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

    const execution = await hydrateAndRunWorkflow(target, event, { registry, services, hydrator });
    await executionRepository.create(execution);

    return { found: true, status: execution.status, outputs: execution.outputs, executionId: execution.id };
  },
});
