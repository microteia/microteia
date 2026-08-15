import type { ExpressionFunction } from '../FunctionRegistry';

import { LocalizedError } from '../../../errors/LocalizedError';
export const getVarFn: ExpressionFunction = {
  name: 'getVar',
  call: ([varName], context) => {
    if (typeof varName !== 'string') {
      throw new LocalizedError('@core.automation/expr.arg.variable-name', { fn: 'getVar' });
    }
    
    const value = context.variables[varName];
    
    if (value === undefined) {
      throw new LocalizedError(
        '@core.automation/expr.get-var.not-found',
        { name: String(varName) },
      );
    }
    
    return value;
  },
  description: '@core.automation/expr.getVar.description',
  signature: 'getVar(variableName)',
  example: 'getVar("valorAnterior")',
  category: '@core.automation/expr.category.variable',
  minArgs: 1,
  maxArgs: 1,
};
