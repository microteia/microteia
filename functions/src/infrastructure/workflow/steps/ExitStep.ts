import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';

export const makeExitStepDefinition = (): StepDefinition => ({
  id: 'exit',
  version: 1,
  name: '@core.automation/step.exit.name',
  description:
    'Encerra o workflow neste ponto e devolve as saídas do step anterior como resultado. Útil para sair de dentro de um ramo de condição ou de uma repetição sem executar os steps seguintes.',
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
