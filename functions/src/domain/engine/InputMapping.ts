import type { InputMapping } from '../entities/Workflow';
import type { WorkflowContext } from '../entities/WorkflowContext';
import type { InputDefinition } from './StepDefinition';
import { expressionEngine } from './expression/ExpressionEngine';

const resolveEventPath = (payload: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && key in (value as Record<string, unknown>)) {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, payload);

const resolveOutputPath = (outputs: Record<string, unknown>, stepId: string, outputId: string): unknown => {
  const stepOutputs = outputs[stepId];
  if (!stepOutputs || typeof stepOutputs !== 'object') return undefined;
  return resolveEventPath(stepOutputs as Record<string, unknown>, outputId);
};

// As 5 variantes de InputMapping são o vocabulário fechado do próprio motor (não são
// extensíveis por plugins), diferente do StepType — por isso um switch aqui não viola a
// exigência de "nunca switch(stepType)"; adicionar um novo tipo de mapping é uma mudança de
// linguagem do engine, não uma integração de módulo.
const resolveMapping = (mapping: InputMapping, context: WorkflowContext): unknown => {
  switch (mapping.kind) {
    case 'Literal':
      return mapping.value;
    case 'Event':
      return resolveEventPath(context.event.payload, mapping.path);
    case 'Expression':
      return expressionEngine.evaluate(mapping.expression, context);
    case 'Output':
      return resolveOutputPath(context.outputs, mapping.stepId, mapping.outputId);
    case 'Variable':
      return context.variables[mapping.name];
    default:
      return undefined;
  }
};

export const resolveInputs = (
  inputs: InputDefinition[],
  configuration: Record<string, InputMapping>,
  context: WorkflowContext,
): Record<string, unknown> => {
  const resolved: Record<string, unknown> = {};
  for (const input of inputs) {
    const mapping = configuration[input.id];
    let value = mapping ? resolveMapping(mapping, context) : undefined;
    if (value === undefined) value = input.defaultValue;
    if (input.required && value === undefined) {
      throw new Error(`Entrada obrigatória "${input.label}" não foi informada`);
    }
    const validationError = input.validator?.(value);
    if (validationError) {
      throw new Error(`Entrada "${input.label}" inválida: ${validationError}`);
    }
    resolved[input.id] = value;
  }
  return resolved;
};
