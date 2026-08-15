import type { WorkflowParameterType } from '../../domain/entities/Workflow';

/**
 * O nome de cada tipo de parâmetro como CHAVE do namespace `core.automation`. Fica aqui, e não em
 * cada tela, porque a lista aparece no editor de Script, no de Workflow e no de validação — três
 * cópias que já divergiram uma vez no rótulo do tipo `Object`.
 */
export const PARAMETER_TYPE_KEYS: Record<WorkflowParameterType, string> = {
  String: 'parameter.type.string',
  Number: 'parameter.type.number',
  Date: 'parameter.type.date',
  Boolean: 'parameter.type.boolean-label',
  select: 'parameter.type.select',
  lookup: 'parameter.type.lookup',
  EntityReference: 'parameter.type.entity-record',
  Object: 'parameter.type.object-short',
};
