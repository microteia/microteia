import type { WorkflowDefinition, WorkflowEvent } from '../entities/Workflow';
import type { WorkflowActor, WorkflowServices } from '../entities/WorkflowContext';
import type { IWorkflowDefinitionRepository } from '../repositories/IWorkflowDefinitionRepository';
import type { IWorkflowExecutionRepository } from '../repositories/IWorkflowExecutionRepository';
import type { StepRegistry } from '../engine/StepRegistry';
import { WorkflowContextHydrator, createHydrationCache } from '../engine/WorkflowContextHydrator';
import { hydrateAndRunWorkflow } from '../engine/hydrateAndRunWorkflow';
import { WORKFLOW_CALLED_EVENT } from '../schema/eventCatalog';
import { dateReachedEventName, dateReachedPrefix } from '../schema/workflowClock';

export type RunWorkflowsForEventUseCase = {
  /**
   * `actor` é a pessoa que publicou o evento — `runWorkflow`, `run_workflow` ou um `call-workflow` que
   * não espera —, sem permissões. Ausente nos gatilhos de gravação (`.saved`/`.deleted`): ali a
   * automação é consequência de um documento ter mudado, não o gesto de alguém.
   */
  execute: (event: WorkflowEvent, actor?: WorkflowActor) => Promise<void>;
};

/**
 * As extensões DESATIVADAS do escritório. Desativar mantém os artefatos como documentos do escritório
 * — é o que permite religar sem reinstalar —, e por isso é aqui, na execução, que o interruptor vale.
 */
export type DeactivatedPluginIds = (tenantId: string) => Promise<ReadonlySet<string>>;

/**
 * O gatilho de data na GRAVAÇÃO: as automações `<prefixo>.dateReached` que vieram na mesma consulta da
 * gravação, para quem decide se o registro acabou de chegar ao dia. Ver `dateReachedOnSave`.
 */
export type DateReachedOnSave = (event: WorkflowEvent, definitions: WorkflowDefinition[]) => Promise<unknown>;

const SAVED_SUFFIX = '.saved';

/**
 * Uma automação de extensão fica parada quando TODAS as donas dela estão desativadas: compartilhada,
 * ela continua devida enquanto uma delas estiver ligada. A do escritório (sem dona) nunca para por aqui.
 * Só a desativação explícita conta — uma dona que não aparece entre as instaladas é o caso de sempre, e
 * continuar rodando é o que ela já fazia.
 */
export const isSwitchedOff = (definition: WorkflowDefinition, deactivated: ReadonlySet<string>): boolean => {
  const owners = definition.ownerPluginIds ?? [];
  return owners.length > 0 && owners.every((owner) => deactivated.has(owner));
};

const findTargeted = async (
  definitionRepository: IWorkflowDefinitionRepository,
  event: WorkflowEvent,
): Promise<WorkflowDefinition[]> => {
  if (event.target) {
    const target = await definitionRepository.findById(event.tenantId, event.target);
    return target && target.enabled && target.eventName === event.name ? [target] : [];
  }
  if (event.name === WORKFLOW_CALLED_EVENT) {
    const targetId = typeof event.payload.__targetWorkflowId === 'string' ? event.payload.__targetWorkflowId : null;
    if (!targetId) return [];
    const target = await definitionRepository.findByRef(event.tenantId, targetId);
    return target && target.enabled && target.eventName === WORKFLOW_CALLED_EVENT ? [target] : [];
  }
  // A gravação de um registro pergunta também pelas automações de DATA da coleção — na MESMA consulta.
  if (event.name.endsWith(SAVED_SUFFIX)) {
    const prefix = event.name.slice(0, -SAVED_SUFFIX.length);
    return definitionRepository.findEnabledByEvents(event.tenantId, [event.name, dateReachedEventName(prefix)]);
  }
  return definitionRepository.findEnabledByEvent(event.tenantId, event.name);
};

export const makeRunWorkflowsForEventUseCase = (
  definitionRepository: IWorkflowDefinitionRepository,
  executionRepository: IWorkflowExecutionRepository,
  registry: StepRegistry,
  services: WorkflowServices,
  hydrator: WorkflowContextHydrator,
  deactivatedPluginIds?: DeactivatedPluginIds,
  onDateReachedSave?: DateReachedOnSave,
): RunWorkflowsForEventUseCase => ({
  execute: async (event, actor) => {
    const found = await findTargeted(definitionRepository, event);
    if (found.length === 0) return;

    const owned = found.some((definition) => (definition.ownerPluginIds ?? []).length > 0);
    const deactivated = owned && deactivatedPluginIds ? await deactivatedPluginIds(event.tenantId) : new Set<string>();
    const active = found.filter((definition) => !isSwitchedOff(definition, deactivated));
    const fromSave = !event.target && event.name.endsWith(SAVED_SUFFIX);
    const dateReached = fromSave ? active.filter((definition) => dateReachedPrefix(definition.eventName) !== null) : [];
    const definitions = fromSave ? active.filter((definition) => definition.eventName === event.name) : active;

    if (dateReached.length > 0 && onDateReachedSave) {
      try {
        await onDateReachedSave(event, dateReached);
      } catch (error) {
        services.logger.error(
          `Falha ao conferir o gatilho de data na gravação "${event.name}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
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
