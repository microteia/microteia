import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';

export const makeExitStepDefinition = (): StepDefinition => ({
  id: 'exit',
  version: 1,
  name: '@core.automation/step.exit.name',
  description:
    '@core.automation/step.exit.description',
  icon: 'RiLogoutBoxRLine',
  category: 'Action',
  type: 'Action',
  configurable: false,
  inputs: [],
  outputDefinitions: [],
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async () => ({
      success: true,
      message: 'Workflow encerrado',
      halt: true,
    }),
  }),
});
