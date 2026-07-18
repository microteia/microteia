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
  minArgs: 1,
  maxArgs: 1,
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
  minArgs: 1,
  maxArgs: 1,
};

const asSearchText = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);

const UNSAFE_PATH_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isEmptyValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

export const mapFn: ExpressionFunction = {
  name: 'map',
  call: ([array, path, compact]) => {
    if (!Array.isArray(array)) {
      throw new Error('map: primeiro argumento deve ser um array');
    }
    const keys = String(path ?? '')
      .split('.')
      .map((key) => key.trim())
      .filter((key) => key !== '');

    const result =
      keys.length === 0
        ? [...array]
        : array.map((item) =>
            keys.reduce<unknown>((current, key) => {
              if (current === null || typeof current !== 'object') return undefined;
              if (UNSAFE_PATH_KEYS.has(key)) return undefined;
              return (current as Record<string, unknown>)[key];
            }, item),
          );

    return compact ? result.filter((item) => !isEmptyValue(item)) : result;
  },
  description:
    'Extrai uma propriedade de cada item de um array. Com compact = true, descarta os valores vazios',
  signature: 'map(array, caminho, compact?)',
  example: 'map(event.partes, "pessoa.nome", true)',
  category: 'Operador',
  minArgs: 2,
  maxArgs: 3,
};

export const containsFn: ExpressionFunction = {
  name: 'contains',
  call: ([target, value]) => {
    if (Array.isArray(target)) {
      return target.includes(value);
    }
    if (typeof target === 'string') {
      return target.includes(asSearchText(value));
    }
    throw new Error('contains: primeiro argumento deve ser um array ou texto');
  },
  description: 'Verifica se um array contém um valor, ou se um texto contém um trecho',
  signature: 'contains(arrayOuTexto, valor)',
  example: 'contains([1, 2, 3], 2)',
  category: 'Operador',
  minArgs: 2,
  maxArgs: 2,
};

export const indexOfFn: ExpressionFunction = {
  name: 'indexOf',
  call: ([target, value]) => {
    if (Array.isArray(target)) {
      return target.indexOf(value);
    }
    if (typeof target === 'string') {
      return target.indexOf(asSearchText(value));
    }
    throw new Error('indexOf: primeiro argumento deve ser um array ou texto');
  },
  description: 'Retorna a posição de um valor em um array ou texto (-1 se não encontrado)',
  signature: 'indexOf(arrayOuTexto, valor)',
  example: 'indexOf([1, 2, 3], 2)',
  category: 'Operador',
  minArgs: 2,
  maxArgs: 2,
};
