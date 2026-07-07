import type { ExpressionFunction } from '../FunctionRegistry';

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
};

export const floorFn: ExpressionFunction = {
  name: 'floor',
  call: ([value]) => {
    if (typeof value !== 'number') {
      throw new Error('floor: argumento deve ser um número');
    }
    return Math.floor(value);
  },
  description: 'Arredonda um número para baixo',
  signature: 'floor(número)',
  example: 'floor(3.7)',
  category: 'Operador',
};

export const ceilFn: ExpressionFunction = {
  name: 'ceil',
  call: ([value]) => {
    if (typeof value !== 'number') {
      throw new Error('ceil: argumento deve ser um número');
    }
    return Math.ceil(value);
  },
  description: 'Arredonda um número para cima',
  signature: 'ceil(número)',
  example: 'ceil(3.2)',
  category: 'Operador',
};

export const absFn: ExpressionFunction = {
  name: 'abs',
  call: ([value]) => {
    if (typeof value !== 'number') {
      throw new Error('abs: argumento deve ser um número');
    }
    return Math.abs(value);
  },
  description: 'Retorna o valor absoluto de um número',
  signature: 'abs(número)',
  example: 'abs(-5)',
  category: 'Operador',
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
};
