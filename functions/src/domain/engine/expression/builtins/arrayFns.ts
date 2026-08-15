import type { ExpressionFunction } from '../FunctionRegistry';

import { LocalizedError } from '../../../errors/LocalizedError';
export const firstFn: ExpressionFunction = {
  name: 'first',
  call: ([array]) => {
    if (!Array.isArray(array)) {
      throw new LocalizedError('@core.automation/expr.arg.array', { fn: 'first' });
    }
    return array.length > 0 ? array[0] : undefined;
  },
  description: '@core.automation/expr.first.description',
  signature: 'first(array)',
  example: 'first([1, 2, 3])',
  category: '@core.automation/expr.category.operator',
  minArgs: 1,
  maxArgs: 1,
};

export const lastFn: ExpressionFunction = {
  name: 'last',
  call: ([array]) => {
    if (!Array.isArray(array)) {
      throw new LocalizedError('@core.automation/expr.arg.array', { fn: 'last' });
    }
    return array.length > 0 ? array[array.length - 1] : undefined;
  },
  description: '@core.automation/expr.last.description',
  signature: 'last(array)',
  example: 'last([1, 2, 3])',
  category: '@core.automation/expr.category.operator',
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
      throw new LocalizedError('@core.automation/expr.arg.first.array', { fn: 'map' });
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
  signature: 'map(array, path, compact?)',
  example: 'map(event.parties, "person.name", true)',
  category: '@core.automation/expr.category.operator',
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
    throw new LocalizedError('@core.automation/expr.arg.first.array-or-text', { fn: 'contains' });
  },
  description: '@core.automation/expr.contains.description',
  signature: 'contains(arrayOrText, value)',
  example: 'contains([1, 2, 3], 2)',
  category: '@core.automation/expr.category.operator',
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
    throw new LocalizedError('@core.automation/expr.arg.first.array-or-text', { fn: 'indexOf' });
  },
  description: '@core.automation/expr.indexOf.description',
  signature: 'indexOf(arrayOrText, value)',
  example: 'indexOf([1, 2, 3], 2)',
  category: '@core.automation/expr.category.operator',
  minArgs: 2,
  maxArgs: 2,
};
