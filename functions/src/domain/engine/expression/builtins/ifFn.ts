import type { ExpressionFunction } from '../FunctionRegistry';

export const ifFn: ExpressionFunction = {
  name: 'if',
  call: ([condition, whenTrue, whenFalse]) => (condition ? whenTrue : whenFalse),
};
