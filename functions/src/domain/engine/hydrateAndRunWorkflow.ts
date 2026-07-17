import type { WorkflowDefinition, WorkflowEvent, WorkflowExecution } from '../entities/Workflow';
import type { WorkflowServices } from '../entities/WorkflowContext';
import type { StepRegistry } from './StepRegistry';
import { runWorkflow } from './WorkflowExecutor';
import { WorkflowContextHydrator, createHydrationCache, type HydrationCache } from './WorkflowContextHydrator';
import { SCHEMA_VERSION } from '../schema/entityRegistry';
import { WORKFLOW_CALLED_EVENT, workflowParametersToRoot, applyParameterDefaults } from '../schema/eventCatalog';

export interface HydrateAndRunWorkflowDeps {
  registry: StepRegistry;
  services: WorkflowServices;
  hydrator: WorkflowContextHydrator;
  cache?: HydrationCache;
}

export const hydrateAndRunWorkflow = async (
  definition: WorkflowDefinition,
  event: WorkflowEvent,
  deps: HydrateAndRunWorkflowDeps,
): Promise<WorkflowExecution> => {
  const referencedPaths = deps.hydrator.collectReferencedPaths(definition);
  const rootOverride =
    definition.eventName === WORKFLOW_CALLED_EVENT ? workflowParametersToRoot(definition.parameters) : undefined;
  const effectiveEvent =
    definition.eventName === WORKFLOW_CALLED_EVENT && definition.parameters?.length
      ? { ...event, payload: applyParameterDefaults(definition.parameters, event.payload) }
      : event;
  const hydratedEvent = await deps.hydrator.hydrate(
    effectiveEvent,
    referencedPaths,
    deps.cache ?? createHydrationCache(),
    deps.services.logger,
    undefined,
    rootOverride,
  );
  if (hydratedEvent !== effectiveEvent) {
    deps.services.logger.info(
      `Payload hidratado (schema v${SCHEMA_VERSION}) para o workflow "${definition.id}" com ${referencedPaths.length} caminho(s)`,
    );
  }
  return runWorkflow({ definition, event: hydratedEvent, registry: deps.registry, services: deps.services });
};
