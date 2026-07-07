import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';

export const makeSetVariableStepDefinition = (): StepDefinition => ({
  id: 'set-variable',
  version: 1,
  name: 'Definir Variável',
  description: 'Grava um valor em uma variável do workflow, para ser lido por steps seguintes.',
  icon: 'RiBracesLine',
  category: 'Data',
  configurable: true,
  inputs: [
    { id: 'name', label: 'Nome da variável', required: true, type: 'String' },
    { id: 'value', label: 'Valor', required: true, type: 'Expression' },
  ],
  outputDefinitions: [],
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      const name = String(inputs.name);
      context.variables[name] = inputs.value;
      return { success: true, message: `Variável "${name}" definida com valor "${inputs.value}"` };
    },
  }),
});
