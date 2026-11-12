import type { ExpressionCondition, FieldComparisonCondition, WorkflowParameter } from '../../domain/entities/Workflow';
import { getWorkflowEventFields, workflowParametersToFieldOptions } from '../../domain/services/workflowEventCatalog';
import { isParameterRootedEvent } from '../../domain/schema/eventCatalog';
import type { WorkflowEventFieldOption } from '../../domain/services/workflowEventCatalog';
import type { SchemaContext } from '../../domain/schema/pathResolver';

/**
 * O operador vira CHAVE de mensagem, e não frase. É um catálogo de módulo, consumido também fora de
 * componente (`workflowHelpers`), então ele não pode chamar `useT` — quem renderiza traduz.
 */
export const CONDITION_OPERATOR_KEYS: Record<FieldComparisonCondition['operator'], string> = {
  '==': 'condition.operator.eq',
  '!=': 'condition.operator.neq',
  '>': 'condition.operator.gt',
  '>=': 'condition.operator.gte',
  '<': 'condition.operator.lt',
  '<=': 'condition.operator.lte',
  contains: 'condition.operator.contains',
  startsWith: 'condition.operator.starts-with',
  endsWith: 'condition.operator.ends-with',
  isEmpty: 'condition.operator.is-empty',
  isNotEmpty: 'condition.operator.is-not-empty',
};

export const conditionOperatorKey = (operator: FieldComparisonCondition['operator']): string =>
  CONDITION_OPERATOR_KEYS[operator] ?? operator;

export const EVENT_FIELD_PATH_PREFIX = 'event.payload.';

export const createDefaultComparisonCondition = (): FieldComparisonCondition => ({
  kind: 'FieldComparison',
  fieldPath: '',
  operator: '==',
  value: '',
  valueType: 'literal',
});

export const createDefaultExpressionCondition = (): ExpressionCondition => ({
  kind: 'Expression',
  expression: '',
});

export const buildConditionEventFields = (
  eventName: string,
  ctx: SchemaContext,
  parameters?: WorkflowParameter[],
): WorkflowEventFieldOption[] =>
  isParameterRootedEvent(eventName)
    ? workflowParametersToFieldOptions(parameters, ctx)
    : getWorkflowEventFields(eventName, ctx);
