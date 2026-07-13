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
    return 'Nome da variável não pode ser vazio';
  }
  
  if (!VALID_VARIABLE_NAME_PATTERN.test(name)) {
    return 'Nome inválido: deve começar com letra, underscore ou $ e conter apenas letras, números, underscore ou $';
  }
  
  if (JS_RESERVED_WORDS.has(name)) {
    return `"${name}" é uma palavra reservada do JavaScript e não pode ser usada como nome de variável`;
  }
  
  return undefined;
};

export const makeSetVariableStepDefinition = (): StepDefinition => ({
  id: 'set-variable',
  version: 2,
  name: 'Variável',
  description: 'Grava um valor em uma variável do workflow, para ser lido por steps seguintes.',
  icon: 'RiBracesLine',
  category: 'Data',
  type: 'Action',
  configurable: true,
  inputs: [
    { 
      id: 'name', 
      label: 'Nome da variável', 
      required: true, 
      type: 'String',
      allowedMappingKinds: ['Literal'],
      pattern: '^[a-zA-Z_$][a-zA-Z0-9_$]*$',
      patternMessage: 'O nome deve começar com letra, underscore ou $ e conter apenas letras, números, underscore ou $',
      validator: validateVariableName,
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
