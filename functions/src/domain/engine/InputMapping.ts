import type { InputMapping } from '../entities/Workflow';
import type { WorkflowContext } from '../entities/WorkflowContext';
import type { InputDefinition } from './StepDefinition';
import { expressionEngine } from './expression/ExpressionEngine';
import { getValueAtPath, parsePath } from '../schema/pathResolver';
import { applyFormat, checkValue, toEffectiveRules } from '../schema/fieldRules';

import { LocalizedError } from '../errors/LocalizedError';
import { errorParamsOf } from '../errors/LocalizedError';
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
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error?: string;
  errorParams?: Record<string, string>;
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
      // A mensagem interna já é uma REFERÊNCIA. Ela vai como PARÂMETRO, e não concatenada dentro
      // de uma frase: uma referência só resolve quando é o valor inteiro — embutida no meio de um
      // texto ela apareceria crua na tela.
      const detail = error instanceof Error ? error.message : String(error);
      const detailParams = errorParamsOf(error);

      return {
        success: false,
        inputs: resolved,
        error: mapping?.kind === 'Expression'
          ? '@core.automation/input.failed.expression'
          : mapping?.kind === 'Event'
            ? '@core.automation/input.failed.event'
            : '@core.automation/input.failed',
        errorParams: {
          field: input.label,
          source: mapping?.kind === 'Expression'
            ? mapping.expression
            : mapping?.kind === 'Event' ? mapping.path : '',
          // Os parâmetros da mensagem de DENTRO sobem para o mesmo objeto: `resolveParam` os passa
          // adiante ao resolver `{detail}`, então a frase aninhada interpola normalmente.
          ...detailParams,
          detail,
        },
      };
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
    throw new LocalizedError(result.error ?? '', result.errorParams);
  }
  return result.inputs;
};
