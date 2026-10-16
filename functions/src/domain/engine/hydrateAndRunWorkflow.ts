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

/**
 * O evento como os passos o leem: os `parameterDefaults` de um fluxo chamado aplicados, e os registros
 * que a automação navega trazidos. Roda na partida E na retomada depois de um `delay` — a continuação
 * guarda o evento CRU (o registro apontado é lido de novo, e a marca do id gravado não sobreviveria ao
 * JSON da continuação).
 */
export const prepareWorkflowEvent = async (
  definition: WorkflowDefinition,
  event: WorkflowEvent,
  deps: Pick<HydrateAndRunWorkflowDeps, 'hydrator' | 'cache'> & { logger: WorkflowServices['logger'] },
): Promise<WorkflowEvent> => {
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
    deps.logger,
    undefined,
    rootOverride,
  );
  if (hydratedEvent !== effectiveEvent) {
    deps.logger.info(
      `Payload hidratado (schema v${SCHEMA_VERSION}) para o workflow "${definition.id}" com ${referencedPaths.length} caminho(s)`,
    );
  }
  return hydratedEvent;
};

export const hydrateAndRunWorkflow = async (
  definition: WorkflowDefinition,
  event: WorkflowEvent,
  deps: HydrateAndRunWorkflowDeps,
): Promise<WorkflowRun> => {
  const hydratedEvent = await prepareWorkflowEvent(definition, event, { ...deps, logger: deps.services.logger });
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
