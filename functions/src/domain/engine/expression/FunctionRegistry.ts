import type { WorkflowContext } from '../../entities/WorkflowContext';

/**
 * A categoria de uma função como REFERÊNCIA de mensagem. Continua sendo uma UNIÃO fechada, e não
 * `string`, porque era ela que barrava a categoria escrita errado — o que muda é que agora a lista
 * é de chaves, e cada chave tem de existir no catálogo (conferido por `npm run verify-messages`).
 */
export const EXPRESSION_CATEGORIES = [
  '@core.automation/expr.category.date',
  '@core.automation/expr.category.text',
  '@core.automation/expr.category.math',
  '@core.automation/expr.category.conditional',
  '@core.automation/expr.category.variable',
  '@core.automation/expr.category.operator',
  '@core.automation/expr.category.arithmetic',
  '@core.automation/expr.category.comparison',
  '@core.automation/expr.category.logical',
] as const;

export type ExpressionCategory = (typeof EXPRESSION_CATEGORIES)[number];


export interface ExpressionFunction {
  name: string;
  call(args: unknown[], context: WorkflowContext): unknown;
  description: string;
  signature: string;
  example: string;
  category: ExpressionCategory;
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
