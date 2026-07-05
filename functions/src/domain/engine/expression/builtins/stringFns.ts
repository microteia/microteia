import type { ExpressionFunction } from '../FunctionRegistry';

export const concatFn: ExpressionFunction = {
  name: 'concat',
  call: (args) => args.map((arg) => String(arg)).join(''),
};

export const lowerFn: ExpressionFunction = {
  name: 'lower',
  call: ([value]) => String(value).toLowerCase(),
};

export const upperFn: ExpressionFunction = {
  name: 'upper',
  call: ([value]) => String(value).toUpperCase(),
};

export const lengthFn: ExpressionFunction = {
  name: 'length',
  call: ([value]) => {
    if (typeof value === 'string' || Array.isArray(value)) return value.length;
    return 0;
  },
};
