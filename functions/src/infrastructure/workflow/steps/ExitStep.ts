import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';

export const makeExitStepDefinition = (): StepDefinition => ({
  ...coreStepMetadata('exit'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async () => ({
      success: true,
      message: '@core.automation/step.exit.done',
      halt: true,
    }),
  }),
});
