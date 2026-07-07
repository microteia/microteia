import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';

export const makeSetVariableStepDefinition = (): StepDefinition => ({
  id: 'set-variable',
  version: 2,
  name: 'Variável',
  description: 'Grava um valor em uma variável do workflow, para ser lido por steps seguintes.',
  icon: 'RiBracesLine',
  category: 'Data',
  configurable: true,
  inputs: [
    { 
      id: 'name', 
      label: 'Nome da variável', 
      required: true, 
      type: 'String',
      allowedMappingKinds: ['Literal'],
      pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
      patternMessage: 'O nome deve começar com letra ou underscore e conter apenas letras, números e underscores',
    },
    { id: 'value', label: 'Valor', required: true, type: 'Expression' },
  ],
  outputDefinitions: [],
  dynamicOutputs: {
    kind: 'from-input-field',
    sourceInputId: 'name',
    description: 'Variável definida por este step',
  },
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      const name = String(inputs.name);
      const value = inputs.value;
      
      context.variables[name] = value;
      
      return { 
        success: true, 
        message: `Variável "${name}" definida com valor "${String(value)}"`,
        outputs: {
          [name]: value,
        },
      };
    },
  }),
});
