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
import type { WorkflowVersionContent } from '../schema/workflowVersion';
import { flattenSteps } from './stepTree';

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
    ...(suspension.wait ? { wait: suspension.wait } : {}),
    ...(suspension.loop ? { loop: suspension.loop } : {}),
    ...(origin.definition.version > 0 ? { definitionVersion: origin.definition.version } : {}),
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
  /** O conteúdo de uma versão guardada da automação, ou `null` quando ela não foi guardada. */
  findVersion?(tenantId: string, definitionId: string, version: number): Promise<WorkflowVersionContent | null>;
  /** Quando o script ou a automação chamada foi alterada pela última vez — `null` quando não existe mais. */
  dependencyChangedAt?(tenantId: string, kind: 'script' | 'workflow', ref: string): Promise<Date | null>;
}

const literalText = (mapping: unknown): string => {
  const value = (mapping as { kind?: string; value?: unknown } | undefined);
  return value?.kind === 'Literal' && typeof value.value === 'string' ? value.value.trim() : '';
};

/**
 * Os SCRIPTS e as AUTOMAÇÕES CHAMADAS que os passos ainda por rodar usam e que mudaram depois que a
 * execução começou — vira aviso no histórico, e não recusa.
 *
 * A automação é presa à versão em que começou (`pinnedDefinition`) porque mudar a lista de passos muda
 * ONDE a retomada continua — o defeito silencioso. As dependências são resolvidas na hora em que rodam,
 * como uma biblioteca: o contrato com elas é entrada e saída, e uma mudança que o quebra aparece como
 * falha do passo, que o `onError` trata. Abortar seria pior — a maior parte das edições é correção, e uma
 * aprovação que esperou dias seria jogada fora por uma vírgula. O aviso é o que deixa a diferença à vista.
 */
const changedDependencies = async (
  definition: WorkflowDefinition,
  entry: ResumeClockEntry,
  startedAt: Date,
  deps: ResumeWorkflowDeps,
): Promise<{ kind: 'script' | 'workflow'; ref: string }[]> => {
  if (!deps.dependencyChangedAt) return [];
  const topLevel = [...definition.steps].sort((left, right) => left.order - right.order);
  const after = topLevel.findIndex((step) => step.id === entry.afterStepId);
  const remaining = flattenSteps(after < 0 ? [] : topLevel.slice(after + 1)).filter((step) => step.enabled !== false);
  const refs = new Map<string, { kind: 'script' | 'workflow'; ref: string }>();
  for (const step of remaining) {
    const script = step.stepDefinitionId === 'script' ? literalText(step.configuration?.scriptId) : '';
    const workflow = step.stepDefinitionId === 'call-workflow' ? literalText(step.configuration?.targetWorkflowId) : '';
    if (script) refs.set(`script:${script}`, { kind: 'script', ref: script });
    if (workflow) refs.set(`workflow:${workflow}`, { kind: 'workflow', ref: workflow });
  }
  const changed: { kind: 'script' | 'workflow'; ref: string }[] = [];
  for (const dependency of refs.values()) {
    const at = await deps.dependencyChangedAt(entry.tenantId, dependency.kind, dependency.ref).catch(() => null);
    if (at && at.getTime() > startedAt.getTime()) changed.push(dependency);
  }
  return changed;
};

/**
 * A automação como ela ERA quando a execução começou: o conteúdo da versão guardada por cima do estado
 * de agora. O estado continua o de agora — desligada ou apagada cancela, como sempre —; o que volta é o
 * que ela FAZ. Sem a versão guardada (uma execução de antes do versionamento), segue a de agora.
 */
const pinnedDefinition = async (
  definition: WorkflowDefinition,
  entry: ResumeClockEntry,
  deps: ResumeWorkflowDeps,
): Promise<WorkflowDefinition> => {
  if (!entry.definitionVersion || entry.definitionVersion === definition.version || !deps.findVersion) return definition;
  const content = await deps.findVersion(entry.tenantId, entry.definitionId, entry.definitionVersion);
  return content ? { ...definition, ...content, version: entry.definitionVersion } as WorkflowDefinition : definition;
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

  const current = await deps.definitionRepository.findById(entry.tenantId, entry.definitionId);
  if (!current) return end('CANCELLED', 'WARN', '@core.automation/run.delay.cancelled.deleted');
  if (!current.enabled) return end('CANCELLED', 'WARN', '@core.automation/run.delay.cancelled.disabled');
  if (await isSwitchedOff(current, deps)) return end('CANCELLED', 'WARN', '@core.automation/run.delay.cancelled.extension-off');
  const definition = await pinnedDefinition(current, entry, deps);
  const warnedAt = deps.now();
  const resumeLogs = [
    ...logs,
    // O passo que pausou já está no histórico — com as saídas de QUANDO pausou (o prazo: `timedOut`, o
    // desfecho de expiração). Retomado por uma decisão ou por um evento, o resultado verdadeiro é outro, e
    // sem esta linha o histórico diria "venceu o prazo" de uma espera que terminou com o evento.
    ...(entry.decided && entry.outputs[entry.afterStepId]
      ? [{
          stepId: entry.afterStepId,
          level: 'INFO' as const,
          message: '@core.automation/run.resume.step-outputs',
          messageParams: { step: entry.afterStepId },
          outputs: entry.outputs[entry.afterStepId],
          at: warnedAt,
        }]
      : []),
    ...(definition.version !== current.version
      ? [{
          level: 'INFO' as const,
          message: '@core.automation/run.resume.pinned',
          messageParams: { version: String(definition.version) },
          at: warnedAt,
        }]
      : []),
    ...(await changedDependencies(definition, entry, startedAt, deps)).map((dependency) => ({
      level: 'WARN' as const,
      message: dependency.kind === 'script'
        ? '@core.automation/run.resume.script-changed'
        : '@core.automation/run.resume.workflow-changed',
      messageParams: { ref: dependency.ref },
      at: warnedAt,
    })),
  ];

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
        logs: resumeLogs,
        afterStepId: entry.afterStepId,
        lastStepId: entry.lastStepId,
        outputs: entry.outputs,
        variables: entry.variables,
        ...(entry.loop ? { loop: entry.loop } : {}),
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
