import type { ExpressionFunction } from '../FunctionRegistry';

export const firstFn: ExpressionFunction = {
  name: 'first',
  call: ([array]) => {
    if (!Array.isArray(array)) {
      throw new Error('first: argumento deve ser um array');
    }
    return array.length > 0 ? array[0] : undefined;
  },
  description: 'Retorna o primeiro elemento de um array',
  signature: 'first(array)',
  example: 'first([1, 2, 3])',
  category: 'Operador',
};

export const lastFn: ExpressionFunction = {
  name: 'last',
  call: ([array]) => {
    if (!Array.isArray(array)) {
      throw new Error('last: argumento deve ser um array');
    }
    return array.length > 0 ? array[array.length - 1] : undefined;
  },
  description: 'Retorna o último elemento de um array',
  signature: 'last(array)',
  example: 'last([1, 2, 3])',
  category: 'Operador',
};

export const containsFn: ExpressionFunction = {
  name: 'contains',
  call: ([array, value]) => {
    if (!Array.isArray(array)) {
      throw new Error('contains: primeiro argumento deve ser um array');
    }
    return array.includes(value);
  },
  description: 'Verifica se um array contém um valor específico',
  signature: 'contains(array, valor)',
  example: 'contains([1, 2, 3], 2)',
  category: 'Operador',
};

export const indexOfFn: ExpressionFunction = {
  name: 'indexOf',
  call: ([array, value]) => {
    if (typeof array === 'string') {
      if (typeof value !== 'string') {
        throw new Error('indexOf: quando o primeiro argumento é string, o segundo também deve ser');
      }
      return array.indexOf(value);
    }
    if (Array.isArray(array)) {
      return array.indexOf(value);
    }
    throw new Error('indexOf: primeiro argumento deve ser uma string ou array');
  },
  description: 'Retorna a posição de um valor em um array ou texto (-1 se não encontrado)',
  signature: 'indexOf(arrayOuTexto, valor)',
  example: 'indexOf([1, 2, 3], 2)',
  category: 'Operador',
};
