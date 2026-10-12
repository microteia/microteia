import type { IWorkflowClockRepository, WorkflowClockEntry } from '../repositories/IWorkflowClockRepository';
import type { WorkflowSchedule } from '../schema/workflowClock';
import {
  WORKFLOW_SCHEDULE_EVENT,
  nextCronOccurrence,
  parseCron,
  scheduleIssues,
  scheduleTimeZone,
} from '../schema/workflowClock';

export interface WorkflowClockDeps {
  repository: IWorkflowClockRepository;
  officeTimeZone(tenantId: string): Promise<string>;
  now(): Date;
  logger: { info(message: string): void; warn(message: string): void; error(message: string): void };
}

/** O que o relógio precisa saber de uma definição — os três campos que decidem se ela tem horário. */
export interface ClockedDefinition {
  enabled?: unknown;
  eventName?: unknown;
  schedule?: unknown;
}

export const isScheduledDefinition = (definition: ClockedDefinition | null | undefined): boolean =>
  !!definition && definition.eventName === WORKFLOW_SCHEDULE_EVENT;

const validSchedule = (definition: ClockedDefinition): WorkflowSchedule | null => {
  if (definition.enabled !== true || definition.eventName !== WORKFLOW_SCHEDULE_EVENT) return null;
  if (scheduleIssues(definition.schedule).length > 0) return null;
  const schedule = definition.schedule as WorkflowSchedule;
  return { cron: schedule.cron.trim(), ...(schedule.timeZone ? { timeZone: schedule.timeZone.trim() } : {}) };
};

/**
 * Põe o relógio de uma automação de acordo com a definição dela: cria, recalcula ou apaga a entrada.
 *
 * Gravar a definição sem mudar o horário NÃO recalcula `nextRunAt`. Renomear uma automação às 7h59 não
 * pode empurrar o disparo das 8h para amanhã, nem antecipá-lo.
 */
export const syncWorkflowClockEntry = async (
  tenantId: string,
  definitionId: string,
  definition: ClockedDefinition | null,
  deps: WorkflowClockDeps,
): Promise<void> => {
  const schedule = definition ? validSchedule(definition) : null;
  if (!schedule) {
    await deps.repository.remove(tenantId, definitionId);
    return;
  }

  const timeZone = scheduleTimeZone(schedule, await deps.officeTimeZone(tenantId));
  const current = await deps.repository.find(tenantId, definitionId);
  if (current && current.cron === schedule.cron && current.timeZone === timeZone) return;

  const parsed = parseCron(schedule.cron);
  const nextRunAt = parsed ? nextCronOccurrence(parsed, deps.now(), timeZone) : null;
  if (!nextRunAt) {
    await deps.repository.remove(tenantId, definitionId);
    return;
  }

  await deps.repository.save({
    tenantId,
    definitionId,
    kind: 'schedule',
    cron: schedule.cron,
    declaredTimeZone: schedule.timeZone ?? null,
    timeZone,
    nextRunAt,
  });
};

export interface WorkflowClockRoundResult {
  fired: number;
  stale: number;
  failed: number;
  /** Havia mais vencidas do que o lote — a próxima volta continua de onde esta parou. */
  saturated: boolean;
}

const WORKFLOW_CLOCK_BATCH = 100;
const WORKFLOW_CLOCK_CONCURRENCY = 10;

/**
 * A próxima ocorrência depois da que está disparando — calculada com o fuso de AGORA, e é isso que faz
 * a troca de fuso do escritório se corrigir sozinha depois de um disparo.
 *
 * Contada a partir do maior entre o previsto e o agora: um relógio que ficou parado dispara UMA vez a
 * ocorrência atrasada, e não uma rajada com todas as que perdeu.
 */
const followingOccurrence = async (entry: WorkflowClockEntry, now: Date, deps: WorkflowClockDeps): Promise<{ next: Date | null; timeZone: string }> => {
  const timeZone = entry.declaredTimeZone
    ? scheduleTimeZone({ cron: entry.cron, timeZone: entry.declaredTimeZone }, entry.timeZone)
    : await deps.officeTimeZone(entry.tenantId);
  const parsed = parseCron(entry.cron);
  const from = entry.nextRunAt.getTime() > now.getTime() ? entry.nextRunAt : now;
  return { next: parsed ? nextCronOccurrence(parsed, from, timeZone) : null, timeZone };
};

const fireEntry = async (entry: WorkflowClockEntry, deps: WorkflowClockDeps): Promise<'fired' | 'stale'> => {
  const now = deps.now();
  const { next, timeZone } = await followingOccurrence(entry, now, deps);
  const payload = { scheduledFor: entry.nextRunAt, firedAt: now };
  return deps.repository.fire({ ...entry, timeZone }, payload, next);
};

/**
 * Uma volta do relógio: dispara as automações vencidas em todos os escritórios.
 *
 * O relógio só ACORDA — publica o evento com o alvo e deixa a execução com `onWorkflowEventCreated`,
 * como qualquer outro gatilho. Assim a automação de horário passa pelo mesmo interruptor de extensão
 * desativada, pela mesma hidratação e grava o mesmo histórico de execução.
 */
export const runWorkflowClockRound = async (deps: WorkflowClockDeps): Promise<WorkflowClockRoundResult> => {
  const due = await deps.repository.due(deps.now(), WORKFLOW_CLOCK_BATCH);
  const result: WorkflowClockRoundResult = { fired: 0, stale: 0, failed: 0, saturated: due.length >= WORKFLOW_CLOCK_BATCH };

  for (let start = 0; start < due.length; start += WORKFLOW_CLOCK_CONCURRENCY) {
    const slice = due.slice(start, start + WORKFLOW_CLOCK_CONCURRENCY);
    const outcomes = await Promise.allSettled(slice.map((entry) => fireEntry(entry, deps)));
    outcomes.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') {
        result[outcome.value] += 1;
        return;
      }
      result.failed += 1;
      const entry = slice[index];
      deps.logger.error(
        `[workflow-clock] Falha ao disparar ${entry.tenantId}/${entry.definitionId}: ${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`,
      );
    });
  }
  return result;
};
