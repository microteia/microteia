import type { WorkflowEvent } from '../entities/Workflow';
import type { WorkflowServices } from '../entities/WorkflowContext';
import type { IWorkflowDefinitionRepository } from '../repositories/IWorkflowDefinitionRepository';
import type { IWorkflowExecutionRepository } from '../repositories/IWorkflowExecutionRepository';
import type { StepRegistry } from '../engine/StepRegistry';
import { runWorkflow } from '../engine/WorkflowExecutor';

export type RunWorkflowsForEventUseCase = {
  execute: (event: WorkflowEvent) => Promise<void>;
};

export const makeRunWorkflowsForEventUseCase = (
  definitionRepository: IWorkflowDefinitionRepository,
  executionRepository: IWorkflowExecutionRepository,
  registry: StepRegistry,
  services: WorkflowServices,
): RunWorkflowsForEventUseCase => ({
  execute: async (event) => {
    const definitions = await definitionRepository.findEnabledByEvent(event.tenantId, event.name);
    for (const definition of definitions) {
      try {
        const execution = await runWorkflow({ definition, event, registry, services });
        await executionRepository.create(execution);
      } catch (error) {
        services.logger.error(
          `Falha ao executar workflow "${definition.id}" para o evento "${event.name}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  },
});
