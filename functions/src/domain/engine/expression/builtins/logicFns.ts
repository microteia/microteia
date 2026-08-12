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
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  },
  description: 'Verifica se um valor está vazio (null, undefined, string vazia, array vazio, objeto vazio)',
  signature: 'isEmpty(valor)',
  example: 'isEmpty("")',
  category: 'Condicional',
  minArgs: 1,
  maxArgs: 1,
};

export const isNullFn: ExpressionFunction = {
  name: 'isNull',
  call: ([value]) => value === null || value === undefined,
  description: 'Verifica se um valor é nulo ou indefinido',
  signature: 'isNull(valor)',
  example: 'isNull(event.optionalField)',
  category: 'Condicional',
  minArgs: 1,
  maxArgs: 1,
};

export const isNotNullFn: ExpressionFunction = {
  name: 'isNotNull',
  call: ([value]) => value !== null && value !== undefined,
  description: 'Verifica se um valor não é nulo nem indefinido',
  signature: 'isNotNull(valor)',
  example: 'isNotNull(event.name)',
  category: 'Condicional',
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
  description: 'Retorna o primeiro valor não-nulo/não-indefinido entre os argumentos',
  signature: 'coalesce(valor1, valor2, ...)',
  example: 'coalesce(event.name, "Sem nome")',
  category: 'Condicional',
  minArgs: 1,
};
