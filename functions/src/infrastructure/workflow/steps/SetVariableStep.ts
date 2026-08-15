import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';

// Palavras reservadas do JavaScript que não podem ser usadas como nomes de variáveis
const JS_RESERVED_WORDS = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let',
  'new', 'null', 'return', 'static', 'super', 'switch', 'this', 'throw',
  'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
]);

const VALID_VARIABLE_NAME_PATTERN = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

const validateVariableName = (value: unknown): string | undefined => {
  const name = String(value);
  
  if (!name) {
    return '@core.automation/step.set-variable.name.empty';
  }
  
  if (!VALID_VARIABLE_NAME_PATTERN.test(name)) {
    return '@core.automation/step.set-variable.name.invalid';
  }
  
  if (JS_RESERVED_WORDS.has(name)) {
    return '@core.automation/step.set-variable.name.reserved';
  }
  
  return undefined;
};

export const makeSetVariableStepDefinition = (): StepDefinition => ({
  id: 'set-variable',
  version: 2,
  name: '@core.automation/step.set-variable.name',
  description: '@core.automation/step.set-variable.description',
  icon: 'RiBracesLine',
  category: 'Data',
  type: 'Action',
  configurable: true,
  inputs: [
    { 
      id: 'name', 
      label: '@core.automation/step.set-variable.label.nome-da-variavel', 
      required: true, 
      type: 'String',
      allowedMappingKinds: ['Literal'],
      pattern: '^[a-zA-Z_$][a-zA-Z0-9_$]*$',
      patternMessage: '@core.automation/step.set-variable.name.invalid',
      validator: validateVariableName,
    },
    { id: 'value', label: '@core.automation/step.set-variable.label.valor', required: true, type: 'Expression' },
  ],
  outputDefinitions: [],
  dynamicOutputs: {
    kind: 'from-input-field',
    sourceInputId: 'name',
    description: '@core.automation/step.set-variable.description',
  },
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      const name = String(inputs.name);
      const value = inputs.value;
      
      context.variables[name] = value;
      
      return { 
        success: true, 
        message: '@core.automation/step.set-variable.done',
        messageParams: { name, value: String(value) },
        outputs: {
          [name]: value,
        },
      };
    },
  }),
});
