import type { Condition } from '../entities/Workflow';
import type { WorkflowContext } from '../entities/WorkflowContext';
import { expressionEngine } from './expression/ExpressionEngine';

/**
 * Acessa campos aninhados via dot-path (ex: "event.payload.status")
 * Suporta navegação em objetos e arrays.
 */
const getValueByPath = (obj: unknown, path: string): unknown => {
  const keys = path.split('.');
  let value: unknown = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === 'object' && key in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  
  return value;
};

/**
 * Avalia uma comparação de campo único
 */
const evaluateFieldComparison = (
  condition: Extract<Condition, { kind: 'FieldComparison' }>,
  context: WorkflowContext,
): boolean => {
  // Resolve o valor do campo
  const fieldValue = getValueByPath(context, condition.fieldPath);
  
  // Resolve o valor de comparação baseado no tipo
  let compareValue = condition.value;
  if (condition.valueType === 'expression') {
    try {
      compareValue = expressionEngine.evaluate(String(condition.value), context);
    } catch {
      // Se a expressão falhar, considera false sem quebrar a execução
      return false;
    }
  } else if (condition.valueType === 'eventField') {
    compareValue = getValueByPath(context.event.payload, String(condition.value));
  }

  // Operadores que não precisam de valor de comparação
  if (condition.operator === 'isEmpty') {
    return fieldValue === null || fieldValue === undefined || fieldValue === '';
  }
  if (condition.operator === 'isNotEmpty') {
    return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
  }

  // Operadores de comparação
  switch (condition.operator) {
    case '==':
      return fieldValue === compareValue;
    case '!=':
      return fieldValue !== compareValue;
    case '>':
      return Number(fieldValue) > Number(compareValue);
    case '>=':
      return Number(fieldValue) >= Number(compareValue);
    case '<':
      return Number(fieldValue) < Number(compareValue);
    case '<=':
      return Number(fieldValue) <= Number(compareValue);
    case 'contains':
      return String(fieldValue || '').toLowerCase().includes(String(compareValue || '').toLowerCase());
    case 'startsWith':
      return String(fieldValue || '').toLowerCase().startsWith(String(compareValue || '').toLowerCase());
    case 'endsWith':
      return String(fieldValue || '').toLowerCase().endsWith(String(compareValue || '').toLowerCase());
    default:
      throw new Error(`Operador de comparação não suportado: "${condition.operator}"`);
  }
};

/**
 * Avalia uma condição recursivamente.
 * Retorna true/false sem lançar exceção (exceto para tipos desconhecidos).
 */
export const evaluateCondition = (condition: Condition, context: WorkflowContext): boolean => {
  switch (condition.kind) {
    case 'AlwaysTrue':
      return true;

    case 'FieldComparison':
      try {
        return evaluateFieldComparison(condition, context);
      } catch (error) {
        // Log de debug mas não quebra a execução
        context.logger.warn(`Erro ao avaliar condição de campo: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }

    case 'LogicalAnd':
      // Todas as condições devem ser verdadeiras
      return condition.conditions.every((c) => evaluateCondition(c, context));

    case 'LogicalOr':
      // Pelo menos uma condição deve ser verdadeira
      return condition.conditions.some((c) => evaluateCondition(c, context));

    case 'Not':
      // Inverte o resultado
      return !evaluateCondition(condition.condition, context);

    default:
      throw new Error(`Tipo de condição não suportado: "${(condition as Condition).kind}"`);
  }
};
