import type { WorkflowEvent } from '../entities/Workflow';
import type { WorkflowServices } from '../entities/WorkflowContext';
import type { IWorkflowDefinitionRepository } from '../repositories/IWorkflowDefinitionRepository';
import type { IWorkflowExecutionRepository } from '../repositories/IWorkflowExecutionRepository';
import type { StepRegistry } from '../engine/StepRegistry';
import { runWorkflow } from '../engine/WorkflowExecutor';
import { WorkflowContextHydrator, createHydrationCache } from '../engine/WorkflowContextHydrator';
import { SCHEMA_VERSION } from '../schema/entityRegistry';

export type RunWorkflowsForEventUseCase = {
  execute: (event: WorkflowEvent) => Promise<void>;
};

export const makeRunWorkflowsForEventUseCase = (
  definitionRepository: IWorkflowDefinitionRepository,
  executionRepository: IWorkflowExecutionRepository,
  registry: StepRegistry,
  services: WorkflowServices,
  hydrator: WorkflowContextHydrator,
): RunWorkflowsForEventUseCase => ({
  execute: async (event) => {
    const definitions = await definitionRepository.findEnabledByEvent(event.tenantId, event.name);
    if (definitions.length === 0) return;

    const hydrationCache = createHydrationCache();
    for (const definition of definitions) {
      try {
        const referencedPaths = hydrator.collectReferencedPaths(definition);
        const hydratedEvent = await hydrator.hydrate(event, referencedPaths, hydrationCache, services.logger);
        if (hydratedEvent !== event) {
          services.logger.info(
            `Payload hidratado (schema v${SCHEMA_VERSION}) para o workflow "${definition.id}" com ${referencedPaths.length} caminho(s)`,
          );
        }
        const execution = await runWorkflow({ definition, event: hydratedEvent, registry, services });
        await executionRepository.create(execution);
      } catch (error) {
        services.logger.error(
          `Falha ao executar workflow "${definition.id}" para o evento "${event.name}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  },
});
