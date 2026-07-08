import type { WorkflowContext } from '../../entities/WorkflowContext';

export interface ExpressionFunction {
  name: string;
  call(args: unknown[], context: WorkflowContext): unknown;
  description: string;
  signature: string;
  example: string;
  category: 'Data' | 'Texto' | 'Condicional' | 'Variável' | 'Operador';
  minArgs: number;
  maxArgs?: number; // undefined = ilimitado
}

export interface FunctionDefinition {
  name: string;
  description: string;
  signature: string;
  example: string;
  category: string;
  minArgs: number;
  maxArgs?: number;
}

export interface FunctionRegistry {
  register(fn: ExpressionFunction): void;
  resolve(name: string): ExpressionFunction | undefined;
  getAllDefinitions(): FunctionDefinition[];
}

class FunctionRegistryImpl implements FunctionRegistry {
  private functions: Map<string, ExpressionFunction> = new Map();

  register(fn: ExpressionFunction): void {
    this.functions.set(fn.name, fn);
  }

  resolve(name: string): ExpressionFunction | undefined {
    return this.functions.get(name);
  }

  getAllDefinitions(): FunctionDefinition[] {
    return Array.from(this.functions.values()).map((fn) => ({
      name: fn.name,
      description: fn.description,
      signature: fn.signature,
      example: fn.example,
      category: fn.category,
      minArgs: fn.minArgs,
      maxArgs: fn.maxArgs,
    }));
  }
}

export const expressionFunctions: FunctionRegistry = new FunctionRegistryImpl();
