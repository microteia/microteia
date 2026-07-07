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
};
