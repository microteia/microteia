import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';

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
  configurable: true,
  inputs: [
    { 
      id: 'name', 
      label: 'Nome da saída', 
      required: true, 
      type: 'String',
      allowedMappingKinds: ['Literal'],
      defaultValue: 'value',
      pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
      patternMessage: 'O nome deve começar com letra ou underscore e conter apenas letras, números e underscores',
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
