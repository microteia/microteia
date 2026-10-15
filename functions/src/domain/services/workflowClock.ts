import type {
  DateReachedClockEntry,
  DatedRecord,
  IWorkflowClockRepository,
  ResumeClockEntry,
  ScheduleClockEntry,
  WorkflowClockEntry,
} from '../repositories/IWorkflowClockRepository';
import type { WorkflowDefinition, WorkflowEvent } from '../entities/Workflow';
import type { WorkflowClockLastRun, WorkflowClockSkipReason, WorkflowDateReached, WorkflowSchedule } from '../schema/workflowClock';
import {
  DATE_REACHED_CATCH_UP_DAYS,
  DATE_REACHED_MARK_TTL_DAYS,
  DEFAULT_DATE_REACHED_AT,
  WORKFLOW_SCHEDULE_EVENT,
  addDays,
  clockOccurrenceEventId,
  dateReachedCron,
  dateReachedEventName,
  dateReachedFireDay,
  dateReachedIssues,
  dateReachedPrefix,
  dateReachedTargetDay,
  nextCronOccurrence,
  parseCron,
  parseOffsetDays,
  parseTimeOfDay,
  scheduleIssues,
  scheduleTimeZone,
  zonedInstant,
} from '../schema/workflowClock';
import { dayInTimeZone } from '../schema/i18n/timeZone';

export interface WorkflowClockDeps {
  repository: IWorkflowClockRepository;
  officeTimeZone(tenantId: string): Promise<string>;
  /** As extensões desligadas do escritório — a mesma pergunta do motor de execução. */
  deactivatedPluginIds(tenantId: string): Promise<ReadonlySet<string>>;
  /**
   * A coleção de onde vem o evento `<prefixo>.*`, quando `field` é um campo de DATA dela. `null` quando
   * o prefixo não é de tela nenhuma do escritório, ou o campo não é de data — e aí não há o que vigiar.
   */
  resolveDateField(tenantId: string, prefix: string, field: string): Promise<{ collection: string } | null>;
  now(): Date;
  logger: { info(message: string): void; warn(message: string): void; error(message: string): void };
  /** Continua uma execução parada num `delay`. Ver `resumeWorkflowExecution`. */
  resume?(entry: ResumeClockEntry): Promise<'fired' | 'stale'>;
}

/** O que o relógio precisa saber de uma definição — os campos que decidem se ela tem hora marcada. */
export interface ClockedDefinition {
  enabled?: unknown;
  eventName?: unknown;
  schedule?: unknown;
  dateReached?: unknown;
  ownerPluginIds?: unknown;
}

export const isClockedDefinition = (definition: ClockedDefinition | null | undefined): boolean =>
  !!definition
  && typeof definition.eventName === 'string'
  && (definition.eventName === WORKFLOW_SCHEDULE_EVENT || dateReachedPrefix(definition.eventName) !== null);

const ownersOf = (definition: ClockedDefinition): string[] =>
  Array.isArray(definition.ownerPluginIds)
    ? definition.ownerPluginIds.filter((owner): owner is string => typeof owner === 'string')
    : [];

const sameOwners = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().every((owner, index) => owner === [...b].sort()[index]);

const validSchedule = (definition: ClockedDefinition): WorkflowSchedule | null => {
  if (definition.eventName !== WORKFLOW_SCHEDULE_EVENT) return null;
  if (scheduleIssues(definition.schedule).length > 0) return null;
  const schedule = definition.schedule as WorkflowSchedule;
  return { cron: schedule.cron.trim(), ...(schedule.timeZone ? { timeZone: schedule.timeZone.trim() } : {}) };
};

const validDateReached = (definition: ClockedDefinition): (WorkflowDateReached & { prefix: string; offsetDays: number; at: string }) | null => {
  const prefix = typeof definition.eventName === 'string' ? dateReachedPrefix(definition.eventName) : null;
  if (!prefix || dateReachedIssues(definition.dateReached).length > 0) return null;
  const spec = definition.dateReached as WorkflowDateReached;
  return {
    prefix,
    field: spec.field.trim(),
    offset: spec.offset.trim(),
    offsetDays: parseOffsetDays(spec.offset) as number,
    at: spec.at?.trim() || DEFAULT_DATE_REACHED_AT,
  };
};

const syncSchedule = async (
  tenantId: string,
  definitionId: string,
  schedule: WorkflowSchedule,
  owners: string[],
  deps: WorkflowClockDeps,
): Promise<void> => {
  const timeZone = scheduleTimeZone(schedule, await deps.officeTimeZone(tenantId));
  const current = await deps.repository.find(tenantId, definitionId);
  if (current?.kind === 'schedule' && current.cron === schedule.cron && current.timeZone === timeZone) {
    if (!sameOwners(current.ownerPluginIds, owners)) await deps.repository.save({ ...current, ownerPluginIds: owners });
    return;
  }

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
    ownerPluginIds: owners,
    lastRun: current?.kind === 'schedule' ? current.lastRun ?? null : null,
  });
};

const syncDateReached = async (
  tenantId: string,
  definitionId: string,
  spec: NonNullable<ReturnType<typeof validDateReached>>,
  owners: string[],
  deps: WorkflowClockDeps,
): Promise<void> => {
  const timeZone = await deps.officeTimeZone(tenantId);
  const eventName = dateReachedEventName(spec.prefix);
  const current = await deps.repository.find(tenantId, definitionId);
  if (
    current?.kind === 'dateReached'
    && current.eventName === eventName
    && current.field === spec.field
    && current.offsetDays === spec.offsetDays
    && current.at === spec.at
  ) {
    if (!sameOwners(current.ownerPluginIds, owners)) await deps.repository.save({ ...current, ownerPluginIds: owners });
    return;
  }

  const nextRunAt = nextCronOccurrence(parseCron(dateReachedCron(spec)) as NonNullable<ReturnType<typeof parseCron>>, deps.now(), timeZone);
  if (!nextRunAt) return;
  // A primeira volta olha UM dia: o que a hora `at` de `nextRunAt` alcança. Os dias anteriores à
  // declaração não disparam — importar mil registros antigos não pode virar mil avisos.
  const firstRunDay = dayInTimeZone(nextRunAt, timeZone);
  await deps.repository.save({
    tenantId,
    definitionId,
    kind: 'dateReached',
    eventName,
    field: spec.field,
    offsetDays: spec.offsetDays,
    at: spec.at,
    cursorDay: dateReachedTargetDay(addDays(firstRunDay, -1), spec.offsetDays),
    page: null,
    declaredTimeZone: null,
    timeZone,
    nextRunAt,
    ownerPluginIds: owners,
    lastRun: current?.kind === 'dateReached' ? current.lastRun ?? null : null,
  });
};

/**
 * Põe o relógio de uma automação de acordo com a definição dela: cria, recalcula ou apaga a entrada.
 *
 * Gravar a definição sem mudar o que decide o horário NÃO recalcula `nextRunAt`. Renomear uma
 * automação às 7h59 não pode empurrar o disparo das 8h para amanhã, nem antecipá-lo.
 */
export const syncWorkflowClockEntry = async (
  tenantId: string,
  definitionId: string,
  definition: ClockedDefinition | null,
  deps: WorkflowClockDeps,
): Promise<void> => {
  if (!definition || definition.enabled !== true) {
    await deps.repository.remove(tenantId, definitionId);
    return;
  }
  const owners = ownersOf(definition);

  const schedule = validSchedule(definition);
  if (schedule) {
    await syncSchedule(tenantId, definitionId, schedule, owners, deps);
    return;
  }
  const dateReached = validDateReached(definition);
  if (dateReached) {
    await syncDateReached(tenantId, definitionId, dateReached, owners, deps);
    return;
  }
  await deps.repository.remove(tenantId, definitionId);
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

/** Quantos registros uma entrada de data trata por volta. O resto fica para a volta seguinte, na mesma janela. */
export const DATE_REACHED_PAGE_SIZE = 200;
const DATE_REACHED_CLAIM_CONCURRENCY = 20;

const isSwitchedOff = async (entry: WorkflowClockEntry, deps: WorkflowClockDeps): Promise<boolean> => {
  if (entry.ownerPluginIds.length === 0) return false;
  const deactivated = await deps.deactivatedPluginIds(entry.tenantId);
  return entry.ownerPluginIds.every((owner) => deactivated.has(owner));
};

/**
 * A próxima ocorrência depois da que está vencendo — calculada com o fuso de AGORA, e é isso que faz a
 * troca de fuso do escritório se corrigir sozinha depois de um disparo.
 *
 * Contada a partir do maior entre o previsto e o agora: um relógio que ficou parado dispara UMA vez a
 * ocorrência atrasada, e não uma rajada com todas as que perdeu.
 */
const followingOccurrence = async (
  entry: WorkflowClockEntry,
  cron: string,
  now: Date,
  deps: WorkflowClockDeps,
): Promise<{ next: Date | null; timeZone: string }> => {
  const timeZone = entry.declaredTimeZone
    ? scheduleTimeZone({ cron, timeZone: entry.declaredTimeZone }, entry.timeZone)
    : await deps.officeTimeZone(entry.tenantId);
  const parsed = parseCron(cron);
  const from = entry.nextRunAt.getTime() > now.getTime() ? entry.nextRunAt : now;
  return { next: parsed ? nextCronOccurrence(parsed, from, timeZone) : null, timeZone };
};

const skippedRun = (entry: WorkflowClockEntry, now: Date, skipReason: WorkflowClockSkipReason): WorkflowClockLastRun => ({
  scheduledFor: entry.nextRunAt,
  ranAt: now,
  outcome: 'skipped',
  skipReason,
  eventId: null,
  records: null,
});

const fireSchedule = async (entry: ScheduleClockEntry, deps: WorkflowClockDeps): Promise<'fired' | 'stale'> => {
  const now = deps.now();
  const { next, timeZone } = await followingOccurrence(entry, entry.cron, now, deps);
  if (await isSwitchedOff(entry, deps)) {
    if (!next) return 'stale';
    return deps.repository.advance(entry, { nextRunAt: next, timeZone, lastRun: skippedRun(entry, now, 'owners-deactivated') });
  }
  const lastRun: WorkflowClockLastRun = {
    scheduledFor: entry.nextRunAt,
    ranAt: now,
    outcome: 'fired',
    skipReason: null,
    eventId: clockOccurrenceEventId(entry.definitionId, entry.nextRunAt),
    records: null,
  };
  return deps.repository.fire({ ...entry, timeZone }, { scheduledFor: entry.nextRunAt, firedAt: now }, next, lastRun);
};

const markExpiry = (now: Date): Date => new Date(now.getTime() + DATE_REACHED_MARK_TTL_DAYS * 86_400_000);

/** A marca "já disparou": a automação, o registro e o DIA da data — mudar a data é ganhar outra marca. */
const dateReachedMarkId = (definitionId: string, recordId: string, day: string): string =>
  `${definitionId}_${recordId}_${day}`;

const claimRecords = async (
  entry: DateReachedClockEntry,
  records: DatedRecord[],
  timeZone: string,
  now: Date,
  deps: WorkflowClockDeps,
): Promise<number> => {
  let claimed = 0;
  for (let start = 0; start < records.length; start += DATE_REACHED_CLAIM_CONCURRENCY) {
    const slice = records.slice(start, start + DATE_REACHED_CLAIM_CONCURRENCY);
    const outcomes = await Promise.all(slice.map((record) => deps.repository.claimAndPublish(
      entry.tenantId,
      dateReachedMarkId(entry.definitionId, record.id, dayInTimeZone(record.value, timeZone)),
      markExpiry(now),
      { name: entry.eventName, payload: { id: record.id, ...record.data }, target: entry.definitionId },
    )));
    claimed += outcomes.filter(Boolean).length;
  }
  return claimed;
};

/**
 * Uma volta de uma automação de DATA: os registros cuja data cai nos dias que chegaram desde a última
 * volta — no máximo `DATE_REACHED_CATCH_UP_DAYS` para trás —, um evento por registro, com a marca que
 * impede o segundo. Um dia com mais registros que a página continua na volta seguinte, na mesma janela.
 */
const fireDateReached = async (entry: DateReachedClockEntry, deps: WorkflowClockDeps): Promise<'fired' | 'stale'> => {
  const now = deps.now();
  const { next, timeZone } = await followingOccurrence(entry, dateReachedCron(entry), now, deps);
  const today = dayInTimeZone(now, timeZone);
  const lastTarget = dateReachedTargetDay(today, entry.offsetDays);
  const settle = (cursorDay: string, lastRun: WorkflowClockLastRun): Promise<'fired' | 'stale'> =>
    next ? deps.repository.advance(entry, { nextRunAt: next, timeZone, cursorDay, page: null, lastRun }) : Promise.resolve('stale');
  const sameWindowRecords = entry.page && entry.lastRun?.scheduledFor.getTime() === entry.nextRunAt.getTime()
    ? entry.lastRun.records ?? 0
    : 0;
  const firedRun = (records: number): WorkflowClockLastRun => ({
    scheduledFor: entry.nextRunAt,
    ranAt: now,
    outcome: 'fired',
    skipReason: null,
    eventId: null,
    records: sameWindowRecords + records,
  });

  if (await isSwitchedOff(entry, deps)) return settle(lastTarget, skippedRun(entry, now, 'owners-deactivated'));

  const target = await deps.resolveDateField(entry.tenantId, dateReachedPrefix(entry.eventName) ?? '', entry.field);
  if (!target) {
    deps.logger.warn(
      `[workflow-clock] ${entry.tenantId}/${entry.definitionId}: "${entry.field}" não é campo de data de "${entry.eventName}" — nada a vigiar hoje`,
    );
    return settle(lastTarget, skippedRun(entry, now, 'date-field-missing'));
  }

  const fromDay = entry.page?.fromDay ?? [addDays(entry.cursorDay, 1), addDays(lastTarget, 1 - DATE_REACHED_CATCH_UP_DAYS)].sort()[1];
  const toDay = entry.page?.toDay ?? lastTarget;
  if (fromDay > toDay) return settle(toDay, firedRun(0));

  const midnight = { hour: 0, minute: 0 };
  const records = await deps.repository.recordsInRange(
    entry.tenantId,
    target.collection,
    entry.field,
    zonedInstant(fromDay, midnight, timeZone),
    zonedInstant(addDays(toDay, 1), midnight, timeZone),
    entry.page ? { value: entry.page.afterValue, id: entry.page.afterId } : null,
    DATE_REACHED_PAGE_SIZE,
  );
  const claimed = await claimRecords(entry, records, timeZone, now, deps);

  if (records.length === DATE_REACHED_PAGE_SIZE) {
    const last = records[records.length - 1];
    return deps.repository.advance(entry, {
      nextRunAt: entry.nextRunAt,
      timeZone,
      page: { fromDay, toDay, afterValue: last.value, afterId: last.id },
      lastRun: firedRun(claimed),
    });
  }
  return settle(toDay, firedRun(claimed));
};

const fireEntry = (entry: WorkflowClockEntry, deps: WorkflowClockDeps): Promise<'fired' | 'stale'> => {
  if (entry.kind === 'schedule') return fireSchedule(entry, deps);
  if (entry.kind === 'dateReached') return fireDateReached(entry, deps);
  return deps.resume ? deps.resume(entry) : Promise.resolve('stale');
};

/**
 * Uma volta do relógio: dispara as automações vencidas em todos os escritórios.
 *
 * O relógio só ACORDA — publica o evento com o alvo e deixa a execução com `onWorkflowEventCreated`,
 * como qualquer outro gatilho. Assim a automação temporal passa pelo mesmo interruptor de extensão
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

export type DateReachedOnSaveDeps = Pick<WorkflowClockDeps, 'repository' | 'officeTimeZone' | 'now'>;

const valueAtPath = (payload: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>(
    (value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined),
    payload,
  );

/**
 * A metade do gatilho de data que o relógio não alcança: o registro que CHEGA ao dia depois da hora
 * `at` — criado hoje com prazo para hoje, ou com a data mudada à tarde. A volta das 8h já passou, e a
 * próxima olha o dia seguinte. Sem isto, o "aviso no dia" não sairia justamente para o prazo mais urgente.
 *
 * Roda na gravação que o motor JÁ trata (`<prefixo>.saved`), e as automações de data vêm na mesma
 * consulta das de gravação — custo zero de leitura. Só dispara para o dia de HOJE, e só depois da hora:
 * antes dela, quem dispara é o relógio; e um dia que já passou não volta.
 */
export const dateReachedOnSave = async (
  event: WorkflowEvent,
  definitions: WorkflowDefinition[],
  deps: DateReachedOnSaveDeps,
): Promise<number> => {
  if (definitions.length === 0) return 0;
  const now = deps.now();
  const timeZone = await deps.officeTimeZone(event.tenantId);
  const today = dayInTimeZone(now, timeZone);
  const recordId = typeof event.payload.id === 'string' ? event.payload.id : null;
  if (!recordId) return 0;

  let claimed = 0;
  for (const definition of definitions) {
    const spec = validDateReached(definition);
    if (!spec) continue;
    const value = valueAtPath(event.payload, spec.field);
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) continue;

    const recordDay = dayInTimeZone(value, timeZone);
    if (dateReachedFireDay(recordDay, spec.offsetDays) !== today) continue;
    const at = parseTimeOfDay(spec.at) ?? { hour: 0, minute: 0 };
    if (now.getTime() < zonedInstant(today, at, timeZone).getTime()) continue;

    const published = await deps.repository.claimAndPublish(
      event.tenantId,
      dateReachedMarkId(definition.id, recordId, recordDay),
      markExpiry(now),
      { name: definition.eventName, payload: event.payload, target: definition.id },
    );
    if (published) claimed += 1;
  }
  return claimed;
};
