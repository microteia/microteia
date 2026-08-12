import { Parser } from 'expr-eval';
import type { WorkflowContext } from '../../entities/WorkflowContext';
import { expressionFunctions } from './FunctionRegistry';
import { registerExpressionFunctionsFromPlugins } from '../../../infrastructure/workflow/loadWorkflowPlugins';
import { operatorRegistry } from './OperatorRegistry';
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
        throw new Error(`Falta fechar ${openParens - closeParens} parêntese${openParens - closeParens > 1 ? 's' : ''}`);
      }

      if (closeParens > openParens) {
        throw new Error(`Parêntese${closeParens - openParens > 1 ? 's' : ''} de fechamento sem abertura`);
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
      if (errorMessage.includes('Falta fechar') || errorMessage.includes('sem abertura')) {
        throw new Error(errorMessage, { cause: error });
      }

      // Erros comuns do expr-eval traduzidos
      if (errorMessage.includes('TEOF') || errorMessage.includes('EOF')) {
        throw new Error(
          'Expressão incompleta. Verifique se faltam argumentos ou parênteses de fechamento.',
          { cause: error }
        );
      }

      if (errorMessage.includes('unexpected TNAME')) {
        throw new Error(
          'Nome inesperado na expressão. Verifique a sintaxe.',
          { cause: error }
        );
      }

      if (errorMessage.includes('unexpected TNUMBER')) {
        throw new Error(
          'Número em posição incorreta. Verifique operadores e vírgulas.',
          { cause: error }
        );
      }

      if (errorMessage.includes('unexpected TSTRING')) {
        throw new Error(
          'Texto em posição incorreta. Verifique operadores e vírgulas.',
          { cause: error }
        );
      }

      if (errorMessage.includes('unexpected TCOMMA')) {
        throw new Error(
          'Vírgula em posição incorreta. Verifique os argumentos da função.',
          { cause: error }
        );
      }
      
      if (errorMessage.includes('not a valid integer') || errorMessage.includes('not a number')) {
        throw new Error(
          `Operação aritmética inválida. ${errorMessage}. ` +
          `Verifique se está tentando somar/subtrair tipos incompatíveis (ex: Date + número).`,
          { cause: error }
        );
      }

      if (errorMessage.includes('undefined') || errorMessage.includes('is not defined')) {
        const undefinedVar = errorMessage.match(/["']?(\w+)["']?\s+is not defined/)?.[1];
        if (undefinedVar) {
          throw new Error(
            `Variável ou função "${undefinedVar}" não encontrada. ` +
            `Verifique se digitou corretamente ou se a função existe.`,
            { cause: error }
          );
        }
      }

      if (errorMessage.includes('Função de expressão desconhecida')) {
        const match = errorMessage.match(/desconhecida:\s*["']([^"']+)["']/);
        if (match) {
          throw new Error(
            `Função "${match[1]}" não existe. Consulte a lista de funções disponíveis.`,
            { cause: error }
          );
        }
      }

      if (errorMessage.toLowerCase().includes('parse error') || errorMessage.includes('unexpected')) {
        const token = errorMessage.match(/unexpected\s+(\w+)/)?.[1];
        if (token) {
          throw new Error(
            `Símbolo inesperado na expressão. Verifique a sintaxe próximo a "${token}".`,
            { cause: error }
          );
        }
        throw new Error(
          'Erro de sintaxe. Verifique a estrutura da expressão.',
          { cause: error }
        );
      }

      throw new Error(`Erro ao avaliar expressão: ${errorMessage}`, { cause: error });
    }
  }
}

export const expressionEngine: ExpressionEngine = new ExpressionEngineImpl();

// Exporta registries para uso no frontend (autocomplete/validação)
export { expressionFunctions } from './FunctionRegistry';
export { operatorRegistry } from './OperatorRegistry';
export type { ExpressionFunction } from './FunctionRegistry';
export type { ExpressionOperator } from './OperatorRegistry';
