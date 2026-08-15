import type { ExpressionFunction } from '../FunctionRegistry';

export const getVarFn: ExpressionFunction = {
  name: 'getVar',
  call: ([varName], context) => {
    if (typeof varName !== 'string') {
      throw new Error('getVar: o nome da variável deve ser uma string');
    }
    
    const value = context.variables[varName];
    
    if (value === undefined) {
      throw new Error(`getVar: variável "${varName}" não encontrada no contexto`);
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
