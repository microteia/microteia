import type { ExpressionFunction } from '../FunctionRegistry';

export const ifFn: ExpressionFunction = {
  name: 'if',
  call: ([condition, whenTrue, whenFalse]) => (condition ? whenTrue : whenFalse),
  description: 'Retorna um valor baseado em uma condição',
  signature: 'if(condição, valorSeVerdadeiro, valorSeFalso)',
  example: 'if(5 > 3, "sim", "não")',
  category: 'Condicional',
  minArgs: 3,
  maxArgs: 3,
};
