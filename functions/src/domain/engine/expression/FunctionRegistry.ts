import type { WorkflowContext } from '../../entities/WorkflowContext';

export interface ExpressionFunction {
  name: string;
  call(args: unknown[], context: WorkflowContext): unknown;
}

export interface FunctionRegistry {
  register(fn: ExpressionFunction): void;
  resolve(name: string): ExpressionFunction | undefined;
}

class FunctionRegistryImpl implements FunctionRegistry {
  private functions: Map<string, ExpressionFunction> = new Map();

  register(fn: ExpressionFunction): void {
    this.functions.set(fn.name, fn);
  }

  resolve(name: string): ExpressionFunction | undefined {
    return this.functions.get(name);
  }
}

export const expressionFunctions: FunctionRegistry = new FunctionRegistryImpl();
