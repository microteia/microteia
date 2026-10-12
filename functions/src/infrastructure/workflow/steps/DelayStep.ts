import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import { resolveDelay } from '../../../domain/schema/workflowClock';

/**
 * Espera — pausa a execução até um instante, e a mesma execução continua depois. O passo só PEDE
 * (`suspend`); guardar o estado e acordar na hora é do executor e do relógio do kernel. Um instante que
 * já passou não pede nada: o fluxo segue.
 */
export const makeDelayStepDefinition = (): StepDefinition => ({
  ...coreStepMetadata('delay'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      const now = context.services.now();
      const resolution = resolveDelay({ duration: inputs.duration, until: inputs.until }, now);
      if (!('resumeAt' in resolution)) {
        return { success: false, message: resolution.message, messageParams: resolution.messageParams };
      }
      const { resumeAt } = resolution;
      const waits = resumeAt.getTime() > now.getTime();
      return {
        success: true,
        outputs: { resumeAt },
        message: waits ? '@core.automation/step.delay.waiting' : '@core.automation/step.delay.elapsed',
        messageParams: { until: resumeAt.toISOString() },
        ...(waits ? { suspend: { resumeAt } } : {}),
      };
    },
  }),
});
