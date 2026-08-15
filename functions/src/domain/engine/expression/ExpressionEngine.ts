import { Parser } from 'expr-eval';
import type { WorkflowContext } from '../../entities/WorkflowContext';
import { expressionFunctions } from './FunctionRegistry';
import { registerExpressionFunctionsFromPlugins } from '../../../infrastructure/workflow/loadWorkflowPlugins';
import { operatorRegistry } from './OperatorRegistry';
import { LocalizedError } from '../../errors/LocalizedError';
import {
  addOperator, subtractOperator, multiplyOperator, divideOperator, remainderOperator, powerOperator, factorialOperator,
  equalOperator, notEqualOperator, lessThanOperator, lessOrEqualOperator, greaterThanOperator, greaterOrEqualOperator,
  andOperator, orOperator, notOperatorSymbol, ternaryOperator, concatenateOperator, inOperator,
  sinFunction, cosFunction, tanFunction, asinFunction, acosFunction, atanFunction,
  sinhFunction, coshFunction, tanhFunction, asinhFunction, acoshFunction, atanhFunction,
  sqrtFunction, cbrtFunction, logFunction, lnFunction, log10Function, log2Function, lgFunction, log1pFunction,
  expFunction, expm1Function, absFunction, ceilFunction, floorFunction, truncFunction,
  signFunction, minFunction, maxFunction, randomFunction,
} from './builtins/operators';


// Registra operadores built-in do expr-eval para documentação
[
  addOperator, subtractOperator, multiplyOperator, divideOperator, remainderOperator, powerOperator, factorialOperator,
  equalOperator, notEqualOperator, lessThanOperator, lessOrEqualOperator, greaterThanOperator, greaterOrEqualOperator,
  andOperator, orOperator, notOperatorSymbol, ternaryOperator, concatenateOperator, inOperator,
  sinFunction, cosFunction, tanFunction, asinFunction, acosFunction, atanFunction,
  sinhFunction, coshFunction, tanhFunction, asinhFunction, acoshFunction, atanhFunction,
  sqrtFunction, cbrtFunction, logFunction, lnFunction, log10Function, log2Function, lgFunction, log1pFunction,
  expFunction, expm1Function, absFunction, ceilFunction, floorFunction, truncFunction,
  signFunction, minFunction, maxFunction, randomFunction,
].forEach((op) => operatorRegistry.register(op));

/**
 * Configuração ÚNICA do parser. Exportada porque o teste de paridade a usa para PROVAR que toda
 * função do catálogo é de fato alcançável: nome que o `expr-eval` reserva como operador nunca
 * chega à função registrada, e o catálogo não pode anunciar o que não roda.
 */
export const ENGINE_PARSER_OPERATORS = {
  add: true,
  comparison: true,
  concatenate: true,
  conditional: true,
  divide: true,
  factorial: true,
  logical: true,
  multiply: true,
  power: true,
  remainder: true,
  subtract: true,
  sin: true,
  cos: true,
  tan: true,
  asin: true,
  acos: true,
  atan: true,
  sinh: true,
  cosh: true,
  tanh: true,
  asinh: true,
  acosh: true,
  atanh: true,
  sqrt: true,
  log: true,
  ln: true,
  lg: true,
  log10: true,
  abs: true,
  ceil: true,
  floor: true,
  // Desligado de propósito: `round` precisa ser FUNÇÃO para aceitar as casas
  // decimais que o catálogo anuncia. Como operador unário do expr-eval ele engolia
  // o segundo argumento e `round(3.14159, 2)` nem parseava. Ver `mathFns.ts`.
  round: false,
  trunc: true,
  exp: true,
  // Desligado junto com `round`, e pelo mesmo motivo: como operador built-in, `length(null)` devolvia
  // 4 (o expr-eval vira `null` em "null" e conta as letras). Ver `stringFns.ts`.
  length: false,
  in: true,
  random: true,
  min: true,
  max: true,
  cbrt: true,
  expm1: true,
  log1p: true,
  sign: true,
  log2: true,
  // Desativados por segurança para manter o Step puramente avaliativo:
  assignment: false,
  fndef: false,
} as const;

const buildVariablesContext = (context: WorkflowContext): Record<string, unknown> => {
  const variables: Record<string, unknown> = {
    event: context.event.payload,
    input: context.input ?? {},
    output: context.outputs,
    ...context.variables,
  };

  return variables;
};

/**
 * ÚNICO ponto de leitura do catálogo de funções. Garante que as contribuições dos plugins já
 * foram registradas antes de responder — a carga é preguiçosa porque o módulo dos plugins importa
 * os Steps, que importam este motor, e registrar no topo do arquivo leria a lista antes de ela
 * existir. Ler `expressionFunctions` direto pularia essa garantia; use sempre este acessador.
 */
export const loadedExpressionFunctions = (): typeof expressionFunctions => {
  registerExpressionFunctionsFromPlugins();
  return expressionFunctions;
};

const buildFunctionsContext = (context: WorkflowContext): Record<string, (...args: unknown[]) => unknown> => {
  const functions: Record<string, (...args: unknown[]) => unknown> = {};

  const registry = loadedExpressionFunctions();
  const allFunctions = registry.getAllDefinitions();
  allFunctions.forEach((fnDef) => {
    const fn = registry.resolve(fnDef.name);
    if (fn) {
      functions[fnDef.name] = (...args: unknown[]) => fn.call(args, context);
    }
  });

  return functions;
};

export interface ExpressionEngine {
  evaluate(expression: string, context: WorkflowContext): unknown;
}

class ExpressionEngineImpl implements ExpressionEngine {
  evaluate(expression: string, context: WorkflowContext): unknown {
    try {
      // Validações pré-parser para mensagens mais amigáveis
      const openParens = (expression.match(/\(/g) || []).length;
      const closeParens = (expression.match(/\)/g) || []).length;
      
      if (openParens > closeParens) {
        throw new LocalizedError(
          '@core.automation/expr.error.unclosed-paren',
          { count: String(openParens - closeParens) },
        );
      }

      if (closeParens > openParens) {
        throw new LocalizedError('@core.automation/expr.error.unopened-paren');
      }

      // Verifica strings não fechadas
      let inString = false;
      let stringChar: '"' | "'" | null = null;
      let escaped = false;

      for (let i = 0; i < expression.length; i += 1) {
        const char = expression[i];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\' && inString) {
          escaped = true;
          continue;
        }

        if ((char === '"' || char === "'") && !inString) {
          inString = true;
          stringChar = char;
          continue;
        }

        if (char === stringChar && inString) {
          inString = false;
          stringChar = null;
        }
      }

      if (inString) {
        throw new Error(`Falta fechar aspas (${stringChar === '"' ? 'aspas duplas "' : "aspas simples '"})`);
      }

      const parser = new Parser({
        allowMemberAccess: true,
        operators: { ...ENGINE_PARSER_OPERATORS },
      });
      const variables = buildVariablesContext(context);
      const functions = buildFunctionsContext(context);

      Object.entries(functions).forEach(([name, fn]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (parser.functions as any)[name] = fn;
      });

      // expr-eval originalmente suporta apenas number/string/function/object
      // mas estendemos para Date, boolean e outros tipos via nossas funções customizadas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = parser.evaluate(expression, variables as any);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Erros já tratados pelas validações pré-parser
      // Erro que ESTE código já lançou (com a referência dentro): repassa como está, em vez de
      // reconhecê-lo pela frase — que era o que quebrava assim que a frase mudava de idioma.
      if (error instanceof LocalizedError) {
        throw error;
      }

      // Erros comuns do expr-eval traduzidos
      if (errorMessage.includes('TEOF') || errorMessage.includes('EOF')) {
        throw new LocalizedError(
          '@core.automation/expr.error.incomplete',
          undefined,
          { cause: error }
        );
      }

      if (errorMessage.includes('unexpected TNAME')) {
        throw new LocalizedError(
          '@core.automation/expr.error.unexpected-name',
          undefined,
          { cause: error }
        );
      }

      if (errorMessage.includes('unexpected TNUMBER')) {
        throw new LocalizedError(
          '@core.automation/expr.error.unexpected-number',
          undefined,
          { cause: error }
        );
      }

      if (errorMessage.includes('unexpected TSTRING')) {
        throw new LocalizedError(
          '@core.automation/expr.error.unexpected-string',
          undefined,
          { cause: error }
        );
      }

      if (errorMessage.includes('unexpected TCOMMA')) {
        throw new LocalizedError(
          '@core.automation/expr.error.unexpected-comma',
          undefined,
          { cause: error }
        );
      }
      
      if (errorMessage.includes('not a valid integer') || errorMessage.includes('not a number')) {
        throw new LocalizedError(
          '@core.automation/expr.error.arithmetic',
          { detail: errorMessage },
          { cause: error }
        );
      }

      if (errorMessage.includes('undefined') || errorMessage.includes('is not defined')) {
        const undefinedVar = errorMessage.match(/["']?(\w+)["']?\s+is not defined/)?.[1];
        if (undefinedVar) {
          throw new LocalizedError(
            '@core.automation/expr.error.undefined-name',
            { name: undefinedVar },
            { cause: error }
          );
        }
      }

      if (errorMessage.toLowerCase().includes('parse error') || errorMessage.includes('unexpected')) {
        const token = errorMessage.match(/unexpected\s+(\w+)/)?.[1];
        if (token) {
          throw new LocalizedError(
            '@core.automation/expr.error.unexpected-token',
            { token },
            { cause: error }
          );
        }
        throw new LocalizedError(
          '@core.automation/expr.error.syntax',
          undefined,
          { cause: error }
        );
      }

      throw new LocalizedError(
        '@core.automation/expr.error.generic',
        { detail: errorMessage },
        { cause: error },
      );
    }
  }
}

export const expressionEngine: ExpressionEngine = new ExpressionEngineImpl();

// Exporta registries para uso no frontend (autocomplete/validação)
export { expressionFunctions } from './FunctionRegistry';
export { operatorRegistry } from './OperatorRegistry';
export type { ExpressionFunction } from './FunctionRegistry';
export type { ExpressionOperator } from './OperatorRegistry';
