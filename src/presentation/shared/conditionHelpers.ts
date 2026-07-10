import type { ExpressionCondition, FieldComparisonCondition, WorkflowParameter } from '../../domain/entities/Workflow';
import type { ScreenDefinition } from '../../domain/entities';
import { getWorkflowEventFields, WORKFLOW_CALLED_EVENT, workflowParametersToFieldOptions } from '../../domain/services/workflowEventCatalog';
import type { WorkflowEventFieldOption } from '../../domain/services/workflowEventCatalog';
import { sortFieldsByOrder } from '../../domain/services/customFieldValues';

export const CONDITION_OPERATOR_LABELS: Record<FieldComparisonCondition['operator'], string> = {
  '==': 'é igual a',
  '!=': 'é diferente de',
  '>': 'é maior que',
  '>=': 'é maior ou igual a',
  '<': 'é menor que',
  '<=': 'é menor ou igual a',
  contains: 'contém',
  startsWith: 'começa com',
  endsWith: 'termina com',
  isEmpty: 'está vazio',
  isNotEmpty: 'não está vazio',
};

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
  screenKey: string | undefined,
  dynamicScreens: ScreenDefinition[],
  parameters?: WorkflowParameter[],
): WorkflowEventFieldOption[] => {
  if (eventName === WORKFLOW_CALLED_EVENT) return workflowParametersToFieldOptions(parameters);
  let dynamicFields: WorkflowEventFieldOption[] = [];
  if (eventName.startsWith('custom_record.') && screenKey) {
    const definition = dynamicScreens.find((s) => s.id === screenKey);
    if (definition) {
      dynamicFields = sortFieldsByOrder(definition.fields).map((f) => ({ path: f.key, label: f.label }));
    }
  }
  return getWorkflowEventFields(eventName, dynamicFields);
};
