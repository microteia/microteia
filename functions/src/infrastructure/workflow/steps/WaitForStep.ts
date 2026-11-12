import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
import {
  DEFAULT_WAIT_DAYS,
  MAX_WAIT_DAYS,
  WAIT_FOR_STEP_ID,
  isRecordEventName,
} from '../../../domain/schema/workflowWait';

const DAY_MS = 24 * 60 * 60 * 1000;

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** O id do registro: o texto, ou o `id` do registro hidratado que um caminho de referência devolve. */
const recordIdOf = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && !Array.isArray(value)) return textOf((value as Record<string, unknown>).id);
  return '';
};

/**
 * Esperar um evento — a execução PARA até o próximo `eventName` do registro chegar (e atender a
 * `until`, quando declarada), ou até o prazo.
 *
 * O passo só pede a pausa com o que espera (`suspend.wait`); quem retoma antes do prazo é o barramento
 * (`resumeWaitsForEvent`), que grava o registro como chegou nas saídas deste passo. As saídas daqui são
 * as do PRAZO — `timedOut` —, e são elas que valem se nada chegar.
 *
 * Confere antes se a execução pode pausar aqui, como a aprovação: um botão espera a resposta, e um
 * ramo não retoma.
 */
export const makeWaitForStepDefinition = (): StepDefinition => ({
  ...coreStepMetadata(WAIT_FOR_STEP_ID),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      if (context.canSuspend !== true) {
        return { success: false, message: '@core.automation/step.wait-for.cannot-wait' };
      }

      const eventName = textOf(inputs.eventName);
      if (!isRecordEventName(eventName)) {
        return { success: false, message: '@core.automation/step.wait-for.event-invalid', messageParams: { event: eventName } };
      }
      const recordId = recordIdOf(inputs.recordId);
      if (!recordId) return { success: false, message: '@core.automation/step.wait-for.no-record' };

      const declared = Number(inputs.timeoutInDays);
      const days = Number.isFinite(declared) && declared > 0 ? Math.min(declared, MAX_WAIT_DAYS) : DEFAULT_WAIT_DAYS;
      const resumeAt = new Date(context.services.now().getTime() + days * DAY_MS);
      const until = textOf(inputs.until);

      return {
        success: true,
        message: '@core.automation/step.wait-for.waiting',
        messageParams: { event: eventName, until: resumeAt.toISOString() },
        outputs: { matched: false, timedOut: true, record: null, eventId: '', arrivedAt: null },
        suspend: { resumeAt, wait: { eventName, recordId, ...(until ? { until } : {}) } },
      };
    },
  }),
});
