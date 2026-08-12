import type { ExpressionFunction } from '../FunctionRegistry';

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
      throw new Error('round: primeiro argumento deve ser um número');
    }
    if (typeof decimals !== 'number') {
      throw new Error('round: segundo argumento deve ser um número');
    }
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  },
  description: 'Arredonda um número para a quantidade especificada de casas decimais',
  signature: 'round(número, casasDecimais?)',
  example: 'round(3.14159, 2)',
  category: 'Operador',
  minArgs: 1,
  maxArgs: 2,
};

export const minFn: ExpressionFunction = {
  name: 'min',
  call: (args) => {
    if (args.length === 0) {
      throw new Error('min: requer pelo menos um argumento');
    }
    const numbers = args.map((arg) => {
      if (typeof arg !== 'number') {
        throw new Error('min: todos os argumentos devem ser números');
      }
      return arg;
    });
    return Math.min(...numbers);
  },
  description: 'Retorna o menor valor entre os números fornecidos',
  signature: 'min(número1, número2, ...)',
  example: 'min(10, 5, 8)',
  category: 'Operador',
  minArgs: 1,
};

export const maxFn: ExpressionFunction = {
  name: 'max',
  call: (args) => {
    if (args.length === 0) {
      throw new Error('max: requer pelo menos um argumento');
    }
    const numbers = args.map((arg) => {
      if (typeof arg !== 'number') {
        throw new Error('max: todos os argumentos devem ser números');
      }
      return arg;
    });
    return Math.max(...numbers);
  },
  description: 'Retorna o maior valor entre os números fornecidos',
  signature: 'max(número1, número2, ...)',
  example: 'max(10, 5, 8)',
  category: 'Operador',
  minArgs: 1,
};

export const sumFn: ExpressionFunction = {
  name: 'sum',
  call: ([array]) => {
    if (!Array.isArray(array)) {
      throw new Error('sum: argumento deve ser um array');
    }
    return array.reduce((acc, value) => {
      if (typeof value !== 'number') {
        throw new Error('sum: todos os elementos do array devem ser números');
      }
      return acc + value;
    }, 0);
  },
  description: 'Soma todos os números em um array',
  signature: 'sum(array)',
  example: 'sum([1, 2, 3, 4])',
  category: 'Operador',
  minArgs: 1,
  maxArgs: 1,
};

export const avgFn: ExpressionFunction = {
  name: 'avg',
  call: ([array]) => {
    if (!Array.isArray(array)) {
      throw new Error('avg: argumento deve ser um array');
    }
    if (array.length === 0) {
      return 0;
    }
    const sum = array.reduce((acc, value) => {
      if (typeof value !== 'number') {
        throw new Error('avg: todos os elementos do array devem ser números');
      }
      return acc + value;
    }, 0);
    return sum / array.length;
  },
  description: 'Calcula a média dos números em um array',
  signature: 'avg(array)',
  example: 'avg([1, 2, 3, 4])',
  category: 'Operador',
  minArgs: 1,
  maxArgs: 1,
};
