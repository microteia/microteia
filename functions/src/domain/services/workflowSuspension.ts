import type { WorkflowDefinition, WorkflowEvent, WorkflowExecution } from '../entities/Workflow';
import type { WorkflowActor, WorkflowServices } from '../entities/WorkflowContext';
import type { IWorkflowClockRepository, ResumeClockEntry } from '../repositories/IWorkflowClockRepository';
import type { IWorkflowDefinitionRepository } from '../repositories/IWorkflowDefinitionRepository';
import type { IWorkflowExecutionRepository } from '../repositories/IWorkflowExecutionRepository';
import type { StepRegistry } from '../engine/StepRegistry';
import type { WorkflowRun } from '../engine/WorkflowExecutor';
import { runWorkflow } from '../engine/WorkflowExecutor';
import { prepareWorkflowEvent } from '../engine/hydrateAndRunWorkflow';
import type { WorkflowContextHydrator } from '../engine/WorkflowContextHydrator';
import { withBusinessCalendars } from './businessCalendarScope';
import { mentionsBusinessDays } from '../schema/time/businessDays';
import { actorFromPublished, toPublishedActor } from '../engine/workflowActor';

export interface WorkflowSuspensionDeps {
  executionRepository: IWorkflowExecutionRepository;
  clockRepository: IWorkflowClockRepository;
  now(): Date;
}

/**
 * O teto do estado que uma execução leva para a espera. O documento do Firestore aceita 1 MiB, e o que
 * vai junto — o evento hidratado, as saídas de cada passo — cresce com o fluxo. Recusar com folga, e
 * dizendo por quê, é melhor que deixar a gravação falhar sem execução nenhuma para ver.
 */
const MAX_SUSPENSION_BYTES = 800_000;

const appendLog = (
  execution: WorkflowExecution,
  level: 'WARN' | 'ERROR',
  message: string,
  at: Date,
): WorkflowExecution['logs'] => [...execution.logs, { level, message, at }];

/**
 * Grava o desfecho de uma execução — e, quando ela PAROU num `delay`, guarda antes a continuação no
 * relógio. A ordem importa: a continuação primeiro; uma execução `WAITING` sem continuação ficaria
 * esperando para sempre, e a continuação sem a execução só perde o histórico até ali.
 */
export const recordWorkflowRun = async (
  run: WorkflowRun,
  origin: { definition: WorkflowDefinition; event: WorkflowEvent; actor?: WorkflowActor },
  deps: WorkflowSuspensionDeps,
): Promise<void> => {
  const { suspension, ...execution } = run;
  if (!suspension) {
    await deps.executionRepository.create(execution);
    return;
  }

  const entry: ResumeClockEntry = {
    kind: 'resume',
    tenantId: origin.definition.tenantId,
    definitionId: origin.definition.id,
    executionId: execution.id,
    afterStepId: suspension.afterStepId,
    lastStepId: suspension.lastStepId,
    event: {
      id: origin.event.id,
      name: origin.event.name,
      payload: origin.event.payload,
      timestamp: origin.event.timestamp,
    },
    outputs: suspension.outputs,
    variables: suspension.variables,
    actor: origin.actor ? toPublishedActor(origin.actor) : null,
    ...(suspension.taskId ? { taskId: suspension.taskId } : {}),
    nextRunAt: suspension.resumeAt,
    timeZone: 'UTC',
    declaredTimeZone: null,
    ownerPluginIds: origin.definition.ownerPluginIds ?? [],
  };

  if (JSON.stringify(entry).length > MAX_SUSPENSION_BYTES) {
    const now = deps.now();
    await deps.executionRepository.create({
      ...execution,
      status: 'FAILED',
      finishedAt: now,
      resumeAt: undefined,
      logs: appendLog(execution, 'ERROR', '@core.automation/run.delay.too-large', now),
    });
    return;
  }

  await deps.clockRepository.save(entry);
  await deps.executionRepository.create(execution);
};

export interface ResumeWorkflowDeps extends WorkflowSuspensionDeps {
  definitionRepository: IWorkflowDefinitionRepository;
  registry: StepRegistry;
  services: WorkflowServices;
  hydrator: WorkflowContextHydrator;
  deactivatedPluginIds?(tenantId: string): Promise<ReadonlySet<string>>;
  /** Fecha como expirada a tarefa de uma aprovação cujo prazo venceu sem decisão. */
  expireTask?(tenantId: string, taskId: string, at: Date): Promise<void>;
}

const isSwitchedOff = async (definition: WorkflowDefinition, deps: ResumeWorkflowDeps): Promise<boolean> => {
  const owners = definition.ownerPluginIds ?? [];
  if (owners.length === 0 || !deps.deactivatedPluginIds) return false;
  const deactivated = await deps.deactivatedPluginIds(definition.tenantId);
  return owners.every((owner) => deactivated.has(owner));
};

/**
 * Continua uma execução que esperou num `delay`, a partir do passo seguinte, NA MESMA execução — o
 * histórico até a espera, a espera e o resto ficam num documento só.
 *
 * Toma a continuação antes (`claim`): duas voltas do relógio que a vejam juntas continuam uma vez só.
 * Continua na definição de AGORA: a automação desligada, apagada, ou cuja extensão foi desativada
 * durante a espera termina `CANCELLED`, dizendo por quê — não roda o resto como se nada tivesse mudado.
 *
 * Quem disparou volta como IDENTIDADE, sem permissões: o acesso de dias atrás é um retrato vencido.
 */
export const resumeWorkflowExecution = async (
  entry: ResumeClockEntry,
  deps: ResumeWorkflowDeps,
): Promise<'fired' | 'stale'> => {
  if ((await deps.clockRepository.claim(entry)) === 'stale') return 'stale';

  // A aprovação que chega aqui SEM decisão chegou pelo prazo: a tarefa sai da caixa de quem decidia,
  // e a execução segue com o desfecho de expiração que o passo deixou nas saídas.
  if (entry.taskId && !entry.decided) {
    await deps.expireTask?.(entry.tenantId, entry.taskId, deps.now()).catch((error: unknown) => {
      deps.services.logger.warn(
        `Falha ao expirar a tarefa "${entry.taskId}": ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  const previous = await deps.executionRepository.findById(entry.tenantId, entry.executionId);
  const startedAt = previous?.startedAt ?? entry.nextRunAt;
  const logs = previous?.logs ?? [];
  const event: WorkflowEvent = { ...entry.event, tenantId: entry.tenantId };
  const base: WorkflowExecution = {
    id: entry.executionId,
    tenantId: entry.tenantId,
    workflowDefinitionId: entry.definitionId,
    eventId: event.id,
    status: 'CANCELLED',
    startedAt,
    logs,
    outputs: {},
  };

  const end = async (status: 'CANCELLED' | 'FAILED', level: 'WARN' | 'ERROR', message: string): Promise<'fired'> => {
    const now = deps.now();
    await deps.executionRepository.create({ ...base, status, finishedAt: now, logs: appendLog(base, level, message, now) });
    return 'fired';
  };

  const definition = await deps.definitionRepository.findById(entry.tenantId, entry.definitionId);
  if (!definition) return end('CANCELLED', 'WARN', '@core.automation/run.delay.cancelled.deleted');
  if (!definition.enabled) return end('CANCELLED', 'WARN', '@core.automation/run.delay.cancelled.disabled');
  if (await isSwitchedOff(definition, deps)) return end('CANCELLED', 'WARN', '@core.automation/run.delay.cancelled.extension-off');

  const actor = actorFromPublished(entry.actor);
  try {
    const timeZone = deps.services.timeZone ?? (await deps.services.timeZoneOf?.(entry.tenantId, actor?.userId));
    const services = await withBusinessCalendars(
      timeZone ? { ...deps.services, timeZone } : deps.services,
      entry.tenantId,
      mentionsBusinessDays(JSON.stringify(definition)),
    );
    const run = await runWorkflow({
      definition,
      event: await prepareWorkflowEvent(definition, event, { hydrator: deps.hydrator, logger: deps.services.logger }),
      registry: deps.registry,
      services,
      ...(actor ? { actor } : {}),
      suspendable: true,
      resume: {
        executionId: entry.executionId,
        startedAt,
        logs,
        afterStepId: entry.afterStepId,
        lastStepId: entry.lastStepId,
        outputs: entry.outputs,
        variables: entry.variables,
      },
    });
    await recordWorkflowRun(run, { definition, event, ...(actor ? { actor } : {}) }, deps);
  } catch (error) {
    deps.services.logger.error(
      `Falha ao retomar a execução "${entry.executionId}": ${error instanceof Error ? error.message : String(error)}`,
    );
    return end('FAILED', 'ERROR', '@core.automation/run.delay.resume-failed');
  }
  return 'fired';
};
