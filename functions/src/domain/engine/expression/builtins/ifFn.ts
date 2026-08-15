import type { ExpressionFunction } from '../FunctionRegistry';

export const ifFn: ExpressionFunction = {
  name: 'if',
  call: ([condition, whenTrue, whenFalse]) => (condition ? whenTrue : whenFalse),
  description: '@core.automation/expr.if.description',
  signature: 'if(condition, valueIfTrue, valueIfFalse)',
  example: 'if(5 > 3, "yes", "no")',
  category: '@core.automation/expr.category.conditional',
  minArgs: 3,
  maxArgs: 3,
};
