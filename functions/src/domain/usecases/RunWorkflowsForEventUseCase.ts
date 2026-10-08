import type { WorkflowDefinition, WorkflowEvent } from '../entities/Workflow';
import type { WorkflowActor, WorkflowServices } from '../entities/WorkflowContext';
import type { IWorkflowDefinitionRepository } from '../repositories/IWorkflowDefinitionRepository';
import type { IWorkflowExecutionRepository } from '../repositories/IWorkflowExecutionRepository';
import type { StepRegistry } from '../engine/StepRegistry';
import { WorkflowContextHydrator, createHydrationCache } from '../engine/WorkflowContextHydrator';
import { hydrateAndRunWorkflow } from '../engine/hydrateAndRunWorkflow';
import { WORKFLOW_CALLED_EVENT } from '../schema/eventCatalog';

export type RunWorkflowsForEventUseCase = {
  /**
   * `actor` é a pessoa que publicou o evento — `runWorkflow`, `run_workflow` ou um `call-workflow` que
   * não espera —, sem permissões. Ausente nos gatilhos de gravação (`.saved`/`.deleted`): ali a
   * automação é consequência de um documento ter mudado, não o gesto de alguém.
   */
  execute: (event: WorkflowEvent, actor?: WorkflowActor) => Promise<void>;
};

export const makeRunWorkflowsForEventUseCase = (
  definitionRepository: IWorkflowDefinitionRepository,
  executionRepository: IWorkflowExecutionRepository,
  registry: StepRegistry,
  services: WorkflowServices,
  hydrator: WorkflowContextHydrator,
): RunWorkflowsForEventUseCase => ({
  execute: async (event, actor) => {
    let definitions: WorkflowDefinition[];
    if (event.name === WORKFLOW_CALLED_EVENT) {
      const targetId = typeof event.payload.__targetWorkflowId === 'string' ? event.payload.__targetWorkflowId : null;
      if (!targetId) return;
      const target = await definitionRepository.findByRef(event.tenantId, targetId);
      definitions = target && target.enabled && target.eventName === WORKFLOW_CALLED_EVENT ? [target] : [];
    } else {
      definitions = await definitionRepository.findEnabledByEvent(event.tenantId, event.name);
    }
    if (definitions.length === 0) return;

    const hydrationCache = createHydrationCache();
    for (const definition of definitions) {
      try {
        const execution = await hydrateAndRunWorkflow(definition, event, {
          registry,
          services,
          hydrator,
          cache: hydrationCache,
          ...(actor ? { actor } : {}),
        });
        await executionRepository.create(execution);
      } catch (error) {
        services.logger.error(
          `Falha ao executar workflow "${definition.id}" para o evento "${event.name}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  },
});
