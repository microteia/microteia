import type { ExpressionFunction } from '../FunctionRegistry';

import { LocalizedError } from '../../../errors/LocalizedError';
/**
 * `floor`, `ceil` e `abs` NÃO moram aqui: são operadores unários do `expr-eval` e o parser os resolve
 * antes de consultar as funções registradas — as implementações daqui nunca eram chamadas. Continuam
 * funcionando pelo built-in e documentados no `operatorRegistry`.
 *
 * `round` é a exceção que justifica a regra: o built-in aceita UM argumento, então a assinatura que
 * este catálogo anuncia (`round(número, casasDecimais?)`) era um erro de sintaxe — o próprio exemplo,
 * `round(3.14159, 2)`, não parseava. Por isso o operador `round` é desligado nas configurações do
 * parser (`ExpressionEngine.ts` e `fieldExpression.ts`): assim esta implementação é alcançada e a
 * assinatura anunciada passa a valer.
 */
export const roundFn: ExpressionFunction = {
  name: 'round',
  call: ([value, decimals = 0]) => {
    if (typeof value !== 'number') {
      throw new LocalizedError('@core.automation/expr.arg.first.number', { fn: 'round' });
    }
    if (typeof decimals !== 'number') {
      throw new LocalizedError('@core.automation/expr.arg.second.number', { fn: 'round' });
    }
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  },
  description: '@core.automation/expr.round.description',
  signature: 'round(number, decimalPlaces?)',
  example: 'round(3.14159, 2)',
  category: '@core.automation/expr.category.operator',
  minArgs: 1,
  maxArgs: 2,
};

export const minFn: ExpressionFunction = {
  name: 'min',
  call: (args) => {
    if (args.length === 0) {
      throw new LocalizedError('@core.automation/expr.arg.at-least-one', { fn: 'min' });
    }
    const numbers = args.map((arg) => {
      if (typeof arg !== 'number') {
        throw new LocalizedError('@core.automation/expr.arg.all.numbers', { fn: 'min' });
      }
      return arg;
    });
    return Math.min(...numbers);
  },
  description: '@core.automation/expr.min.description',
  signature: 'min(number1, number2, ...)',
  example: 'min(10, 5, 8)',
  category: '@core.automation/expr.category.operator',
  minArgs: 1,
};

export const maxFn: ExpressionFunction = {
  name: 'max',
  call: (args) => {
    if (args.length === 0) {
      throw new LocalizedError('@core.automation/expr.arg.at-least-one', { fn: 'max' });
    }
    const numbers = args.map((arg) => {
      if (typeof arg !== 'number') {
        throw new LocalizedError('@core.automation/expr.arg.all.numbers', { fn: 'max' });
      }
      return arg;
    });
    return Math.max(...numbers);
  },
  description: '@core.automation/expr.max.description',
  signature: 'max(number1, number2, ...)',
  example: 'max(10, 5, 8)',
  category: '@core.automation/expr.category.operator',
  minArgs: 1,
};

export const sumFn: ExpressionFunction = {
  name: 'sum',
  call: ([array]) => {
    if (!Array.isArray(array)) {
      throw new LocalizedError('@core.automation/expr.arg.array', { fn: 'sum' });
    }
    return array.reduce((acc, value) => {
      if (typeof value !== 'number') {
        throw new LocalizedError('@core.automation/expr.arg.all-items.numbers', { fn: 'sum' });
      }
      return acc + value;
    }, 0);
  },
  description: '@core.automation/expr.sum.description',
  signature: 'sum(array)',
  example: 'sum([1, 2, 3, 4])',
  category: '@core.automation/expr.category.operator',
  minArgs: 1,
  maxArgs: 1,
};

export const avgFn: ExpressionFunction = {
  name: 'avg',
  call: ([array]) => {
    if (!Array.isArray(array)) {
      throw new LocalizedError('@core.automation/expr.arg.array', { fn: 'avg' });
    }
    if (array.length === 0) {
      return 0;
    }
    const sum = array.reduce((acc, value) => {
      if (typeof value !== 'number') {
        throw new LocalizedError('@core.automation/expr.arg.all-items.numbers', { fn: 'avg' });
      }
      return acc + value;
    }, 0);
    return sum / array.length;
  },
  description: '@core.automation/expr.avg.description',
  signature: 'avg(array)',
  example: 'avg([1, 2, 3, 4])',
  category: '@core.automation/expr.category.operator',
  minArgs: 1,
  maxArgs: 1,
};
