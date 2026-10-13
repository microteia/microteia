import type { WorkflowDefinition, WorkflowEvent } from '../entities/Workflow';
import type { WorkflowContext } from '../entities/WorkflowContext';
import type { WorkflowServices } from '../entities/WorkflowContext';
import type { StepRegistry } from './StepRegistry';
import { runWorkflow } from './WorkflowExecutor';
import type { WorkflowRun } from './WorkflowExecutor';
import { WorkflowContextHydrator, createHydrationCache, type HydrationCache } from './WorkflowContextHydrator';
import { SCHEMA_VERSION } from '../schema/entityRegistry';
import { withBusinessCalendars } from '../services/businessCalendarScope';
import { mentionsBusinessDays } from '../schema/time/businessDays';
import { WORKFLOW_CALLED_EVENT, workflowParametersToRoot, applyParameterDefaults } from '../schema/eventCatalog';

export interface HydrateAndRunWorkflowDeps {
  registry: StepRegistry;
  services: WorkflowServices;
  hydrator: WorkflowContextHydrator;
  cache?: HydrationCache;
  /** Quem disparou, quando alguém disparou. Ver `WorkflowContext.actor`. */
  actor?: WorkflowContext['actor'];
  /** A execução pode pausar num `delay`. Ver `RunWorkflowParams.suspendable`. */
  suspendable?: boolean;
}

export const hydrateAndRunWorkflow = async (
  definition: WorkflowDefinition,
  event: WorkflowEvent,
  deps: HydrateAndRunWorkflowDeps,
): Promise<WorkflowRun> => {
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
  const timeZone =
    deps.services.timeZone ?? (await deps.services.timeZoneOf?.(event.tenantId, deps.actor?.userId));
  // A automação que cita uma conta de dias úteis (numa expressão, num Script) lê os calendários UMA
  // vez, aqui; a que não cita não paga leitura nenhuma. A gravação de um registro com regra de dias
  // úteis carrega por conta própria, em `runWorkflowMutation`.
  const services = await withBusinessCalendars(
    timeZone ? { ...deps.services, timeZone } : deps.services,
    event.tenantId,
    mentionsBusinessDays(JSON.stringify(definition)),
  );
  return runWorkflow({
    definition,
    event: hydratedEvent,
    registry: deps.registry,
    services,
    ...(deps.actor ? { actor: deps.actor } : {}),
    ...(deps.suspendable ? { suspendable: true } : {}),
  });
};
