import type { InputMapping } from '../entities/Workflow';
import type { WorkflowContext } from '../entities/WorkflowContext';
import type { InputDefinition } from './StepDefinition';
import { expressionEngine } from './expression/ExpressionEngine';
import { getValueAtPath, parsePath } from '../schema/pathResolver';
import { applyFormat, checkValue, toEffectiveRules } from '../schema/fieldRules';

import { LocalizedError } from '../errors/LocalizedError';
const resolveEventPath = (payload: Record<string, unknown>, path: string): unknown =>
  getValueAtPath(payload, parsePath(path));

const resolveOutputPath = (outputs: Record<string, unknown>, stepId: string, outputId: string): unknown => {
  const stepOutputs = outputs[stepId];
  if (!stepOutputs || typeof stepOutputs !== 'object') return undefined;
  return resolveEventPath(stepOutputs as Record<string, unknown>, outputId);
};

// As 5 variantes de InputMapping são o vocabulário fechado do próprio motor (não são
// extensíveis por plugins), diferente do StepType — por isso um switch aqui não viola a
// exigência de "nunca switch(stepType)"; adicionar um novo tipo de mapping é uma mudança de
// linguagem do engine, não uma integração de módulo.
export const resolveMapping = (mapping: InputMapping, context: WorkflowContext): unknown => {
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

// Resultado de resolveInputs que pode incluir inputs parcialmente resolvidos
export interface ResolveInputsResult {
  success: boolean;
  inputs: Record<string, unknown>;
  error?: string;
}

export const resolveInputsSafe = (
  inputs: InputDefinition[],
  configuration: Record<string, InputMapping>,
  context: WorkflowContext,
): ResolveInputsResult => {
  const resolved: Record<string, unknown> = {};
  for (const input of inputs) {
    const mapping = configuration[input.id];
    let value: unknown;
    try {
      value = mapping ? resolveMapping(mapping, context) : undefined;
      if (value === undefined) value = input.defaultValue;
      if (input.required && value === undefined) {
        throw new LocalizedError(
          '@core.automation/input.required',
          { label: input.label },
        );
      }

      const rules = toEffectiveRules(input);
      if (rules) {
        value = applyFormat(value, rules.format);
        const ruleIssue = checkValue(value, rules.validate, input.label);
        if (ruleIssue) {
          // O log/erro do motor guarda a CHAVE do motivo; a tela resolve quando o exibe.
          throw new LocalizedError(
            '@core.automation/input.invalid',
            { label: input.label, detail: ruleIssue.error },
          );
        }
      }

      const validationError = input.validator?.(value);
      if (validationError) {
        throw new LocalizedError(
          '@core.automation/input.invalid',
          { label: input.label, detail: validationError },
        );
      }
      resolved[input.id] = value;
    } catch (error) {
      // Enriquece a mensagem de erro com contexto do campo e expressão
      const errorMessage = error instanceof Error ? error.message : String(error);
      let enrichedMessage = `[Campo: ${input.label}]`;

      if (mapping?.kind === 'Expression') {
        enrichedMessage += ` [Expressão: ${mapping.expression}]`;
      } else if (mapping?.kind === 'Event') {
        enrichedMessage += ` [Caminho do evento: ${mapping.path}]`;
      }

      enrichedMessage += ` ${errorMessage}`;
      // Retorna inputs parcialmente resolvidos até o ponto do erro
      return { success: false, inputs: resolved, error: enrichedMessage };
    }
  }
  return { success: true, inputs: resolved };
};

export const resolveInputs = (
  inputs: InputDefinition[],
  configuration: Record<string, InputMapping>,
  context: WorkflowContext,
): Record<string, unknown> => {
  const result = resolveInputsSafe(inputs, configuration, context);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.inputs;
};
