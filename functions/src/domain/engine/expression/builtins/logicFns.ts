import type { ExpressionFunction } from '../FunctionRegistry';

/**
 * `and`, `or` e `not` NÃO moram aqui: o `expr-eval` os reserva como OPERADORES. `and(a, b)` nem
 * parseia ("unexpected TOP: and") e `not(a)` é resolvido pelo operador unário antes de chegar a
 * qualquer função registrada. Enquanto estiveram no catálogo, o editor os oferecia como função e o
 * usuário escrevia algo que só falhava na hora de executar. A forma que funciona — `a and b`,
 * `a or b`, `not a` — é documentada no `operatorRegistry` (`builtins/operators.ts`).
 */
export const isEmptyFn: ExpressionFunction = {
  name: 'isEmpty',
  call: ([value]) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (value instanceof Date) return Number.isNaN(value.getTime());
    if (typeof value === 'object') {
      const proto = Object.getPrototypeOf(value);
      return (proto === Object.prototype || proto === null) && Object.keys(value).length === 0;
    }
    return false;
  },
  description: '@core.automation/expr.isEmpty.description',
  signature: 'isEmpty(value)',
  example: 'isEmpty("")',
  category: '@core.automation/expr.category.conditional',
  minArgs: 1,
  maxArgs: 1,
};

export const isNullFn: ExpressionFunction = {
  name: 'isNull',
  call: ([value]) => value === null || value === undefined,
  description: '@core.automation/expr.isNull.description',
  signature: 'isNull(value)',
  example: 'isNull(event.optionalField)',
  category: '@core.automation/expr.category.conditional',
  minArgs: 1,
  maxArgs: 1,
};

export const isNotNullFn: ExpressionFunction = {
  name: 'isNotNull',
  call: ([value]) => value !== null && value !== undefined,
  description: '@core.automation/expr.isNotNull.description',
  signature: 'isNotNull(value)',
  example: 'isNotNull(event.name)',
  category: '@core.automation/expr.category.conditional',
  minArgs: 1,
  maxArgs: 1,
};

export const coalesceFn: ExpressionFunction = {
  name: 'coalesce',
  call: (args) => {
    for (const arg of args) {
      if (arg !== null && arg !== undefined) {
        return arg;
      }
    }
    return null;
  },
  description: '@core.automation/expr.coalesce.description',
  signature: 'coalesce(value1, value2, ...)',
  example: 'coalesce(event.name, "No name")',
  category: '@core.automation/expr.category.conditional',
  minArgs: 1,
};
