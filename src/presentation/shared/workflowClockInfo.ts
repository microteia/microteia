import { WORKFLOW_CLOCK_TICK_MINUTES } from '../../domain/schema/workflowClock';
import type { WorkflowClockLastRun, WorkflowClockSkipReason, WorkflowClockStatus } from '../../domain/schema/workflowClock';

export interface ClockMessage {
  message: string;
  messageParams?: Record<string, string>;
}

export interface WorkflowClockInfo {
  warning: ClockMessage | null;
  lines: ClockMessage[];
  lastRunEventId: string | null;
}

export interface WorkflowClockInfoInput {
  kind: 'schedule' | 'dateReached';
  enabled: boolean;
  loaded: boolean;
  status: WorkflowClockStatus | null;
  triggerPending: boolean;
  savedAt: Date;
  now: Date;
  expected: { at: Date; timeZone: string } | null;
  format: (instant: Date, timeZone: string) => string;
}

export const CLOCK_SETTLE_MS = 60_000;

const SKIP_MESSAGES: Record<WorkflowClockSkipReason, string> = {
  'owners-deactivated': '@core.automation/workflow.clock.skipped.owners-deactivated',
  'date-field-missing': '@core.automation/workflow.clock.skipped.date-field-missing',
};

const lastRunLine = (
  kind: WorkflowClockInfoInput['kind'],
  run: WorkflowClockLastRun | null,
  timeZone: string,
  format: WorkflowClockInfoInput['format'],
): ClockMessage => {
  if (!run) return { message: '@core.automation/workflow.clock.never' };
  const scheduled = format(run.scheduledFor, timeZone);
  if (run.outcome === 'skipped') {
    return {
      message: run.skipReason ? SKIP_MESSAGES[run.skipReason] : '@core.automation/workflow.clock.skipped',
      messageParams: { scheduled },
    };
  }
  const ran = format(run.ranAt, timeZone);
  if (kind === 'dateReached') {
    return {
      message: '@core.automation/workflow.clock.last-checked',
      messageParams: { scheduled, ran, records: String(run.records ?? 0) },
    };
  }
  return { message: '@core.automation/workflow.clock.last-fired', messageParams: { scheduled, ran } };
};

/**
 * O que a tela da automação diz sobre o relógio do SERVIDOR — e não sobre a prévia calculada no
 * navegador. É o que responde "rodou ou não, e por quê?" sem log: o próximo disparo que o servidor
 * gravou, o último que ele fez (ou pulou, com o motivo), e o aviso quando o servidor e a declaração
 * salva discordam.
 *
 * Logo depois de salvar, o servidor ainda está recalculando: durante `CLOCK_SETTLE_MS` a ausência e a
 * divergência não são acusadas, para não piscar um alarme que se desfaz sozinho.
 */
export const buildWorkflowClockInfo = (input: WorkflowClockInfoInput): WorkflowClockInfo | null => {
  if (!input.enabled) {
    return { warning: null, lines: [{ message: '@core.automation/workflow.clock.inactive' }], lastRunEventId: null };
  }
  if (!input.loaded) return null;

  const { status } = input;
  const pending: ClockMessage[] = input.triggerPending ? [{ message: '@core.automation/workflow.clock.pending' }] : [];
  const settling = input.now.getTime() - input.savedAt.getTime() < CLOCK_SETTLE_MS
    && (!status?.updatedAt || status.updatedAt.getTime() < input.savedAt.getTime());

  if (!status) {
    return settling
      ? { warning: null, lines: [{ message: '@core.automation/workflow.clock.syncing' }, ...pending], lastRunEventId: null }
      : { warning: { message: '@core.automation/workflow.clock.missing' }, lines: pending, lastRunEventId: null };
  }

  const zone = status.timeZone;
  const when = input.format(status.nextRunAt, zone);
  const due = status.nextRunAt.getTime() <= input.now.getTime();
  const nextLine: ClockMessage = due
    ? { message: '@core.automation/workflow.clock.due', messageParams: { when, minutes: String(WORKFLOW_CLOCK_TICK_MINUTES) } }
    : { message: '@core.automation/workflow.clock.next', messageParams: { when } };

  const diverges = !due && !settling && !!input.expected && input.expected.at.getTime() !== status.nextRunAt.getTime();
  const warning: ClockMessage | null = diverges && input.expected
    ? {
      message: '@core.automation/workflow.clock.diverges',
      messageParams: { server: when, expected: input.format(input.expected.at, input.expected.timeZone) },
    }
    : null;

  const run = status.lastRun;
  return {
    warning,
    lines: [nextLine, lastRunLine(input.kind, run, zone, input.format), ...pending],
    lastRunEventId: run?.outcome === 'fired' ? run.eventId : null,
  };
};
