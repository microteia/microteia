import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';

// Palavras reservadas do JavaScript que não podem ser usadas como nomes de outputs
const JS_RESERVED_WORDS = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let',
  'new', 'null', 'return', 'static', 'super', 'switch', 'this', 'throw',
  'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
]);

const VALID_OUTPUT_NAME_PATTERN = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

const validateOutputName = (value: unknown): string | undefined => {
  const name = String(value);
  
  if (!name) {
    return 'Nome da saída não pode ser vazio';
  }
  
  if (!VALID_OUTPUT_NAME_PATTERN.test(name)) {
    return 'Nome inválido: deve começar com letra, underscore ou $ e conter apenas letras, números, underscore ou $';
  }
  
  if (JS_RESERVED_WORDS.has(name)) {
    return `"${name}" é uma palavra reservada do JavaScript e não pode ser usada como nome de saída`;
  }
  
  return undefined;
};

/**
 * Converte um valor em objeto JSON válido.
 * Se o valor já for objeto/array, retorna como está.
 * Se for string que parece JSON, tenta parsear.
 * Caso contrário, retorna o valor primitivo.
 */
const toJsonValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  // Se já é objeto ou array, retorna direto
  if (typeof value === 'object') {
    return value;
  }

  // Se é string, tenta parsear como JSON
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Se falhar o parse, retorna a string como está
        return value;
      }
    }
    return value;
  }

  // Outros tipos primitivos (number, boolean) retornam como estão
  return value;
};

export const makeOutputStepDefinition = (): StepDefinition => ({
  id: 'output',
  version: 1,
  name: 'Saída do Workflow',
  description: 'Define um par nome-valor que será retornado como output do workflow.',
  icon: 'RiExternalLinkLine',
  category: 'Data',
  type: 'Action',
  configurable: true,
  inputs: [
    { 
      id: 'name', 
      label: 'Nome da saída', 
      required: true, 
      type: 'String',
      allowedMappingKinds: ['Literal'],
      defaultValue: 'value',
      pattern: '^[a-zA-Z_$][a-zA-Z0-9_$]*$',
      patternMessage: 'O nome deve começar com letra, underscore ou $ e conter apenas letras, números, underscore ou $',
      validator: validateOutputName,
    },
    { 
      id: 'value', 
      label: 'Valor de saída', 
      required: true, 
      type: 'Expression',
      description: 'O valor será convertido para JSON. Pode ser um valor primitivo, objeto ou array.',
    },
  ],
  outputDefinitions: [],
  dynamicOutputs: {
    kind: 'from-input-field',
    sourceInputId: 'name',
    description: 'Output definido por este step',
  },
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs) => {
      const name = String(inputs.name);
      const rawValue = inputs.value;
      const jsonValue = toJsonValue(rawValue);
      
      return { 
        success: true, 
        message: `Saída {"${name}": ...} `,
        outputs: {
          [name]: jsonValue,
        },
      };
    },
  }),
});
