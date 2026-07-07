import { Parser } from 'expr-eval';
import type { WorkflowContext } from '../../entities/WorkflowContext';
import { expressionFunctions } from './FunctionRegistry';
import { operatorRegistry } from './OperatorRegistry';
import { todayFn, nowFn, formatDateFn, dayOfWeekFn, isWeekendFn, dateDiffFn, yearFn, monthFn, dayFn } from './builtins/dateFns';
import { addDaysFn } from './builtins/addDaysFn';
import { ifFn } from './builtins/ifFn';
import { concatFn, lowerFn, upperFn, lengthFn, trimFn, replaceFn, substringFn, startsWithFn, endsWithFn, splitFn, joinFn, interpolateFn } from './builtins/stringFns';
import { getVarFn } from './builtins/getVarFn';
import { roundFn, floorFn, ceilFn, absFn, minFn, maxFn, sumFn, avgFn } from './builtins/mathFns';
import { firstFn, lastFn, containsFn, indexOfFn } from './builtins/arrayFns';
import { andFn, orFn, notFn, isEmptyFn, isNullFn, isNotNullFn, coalesceFn } from './builtins/logicFns';
import { isCPFFn, isCNPJFn, isEmailFn, formatCPFFn, formatCNPJFn } from './builtins/validationFns';
import {
  addOperator, subtractOperator, multiplyOperator, divideOperator, remainderOperator, powerOperator, factorialOperator,
  equalOperator, notEqualOperator, lessThanOperator, lessOrEqualOperator, greaterThanOperator, greaterOrEqualOperator,
  andOperator, orOperator, notOperatorSymbol, ternaryOperator, concatenateOperator, inOperator,
  sinFunction, cosFunction, tanFunction, asinFunction, acosFunction, atanFunction,
  sinhFunction, coshFunction, tanhFunction, asinhFunction, acoshFunction, atanhFunction,
  sqrtFunction, cbrtFunction, logFunction, lnFunction, log10Function, log2Function, lgFunction, log1pFunction,
  expFunction, expm1Function, absFunction, ceilFunction, floorFunction, roundFunction, truncFunction,
  signFunction, minFunction, maxFunction, randomFunction, lengthFunction,
} from './builtins/operators';

[
  todayFn, nowFn, formatDateFn, dayOfWeekFn, isWeekendFn, dateDiffFn, yearFn, monthFn, dayFn,
  addDaysFn,
  ifFn,
  concatFn, lowerFn, upperFn, lengthFn, trimFn, replaceFn, substringFn, startsWithFn, endsWithFn, splitFn, joinFn, interpolateFn,
  getVarFn,
  roundFn, floorFn, ceilFn, absFn, minFn, maxFn, sumFn, avgFn,
  firstFn, lastFn, containsFn, indexOfFn,
  andFn, orFn, notFn, isEmptyFn, isNullFn, isNotNullFn, coalesceFn,
  isCPFFn, isCNPJFn, isEmailFn, formatCPFFn, formatCNPJFn,
].forEach((fn) => expressionFunctions.register(fn));

// Registra operadores built-in do expr-eval para documentação
[
  addOperator, subtractOperator, multiplyOperator, divideOperator, remainderOperator, powerOperator, factorialOperator,
  equalOperator, notEqualOperator, lessThanOperator, lessOrEqualOperator, greaterThanOperator, greaterOrEqualOperator,
  andOperator, orOperator, notOperatorSymbol, ternaryOperator, concatenateOperator, inOperator,
  sinFunction, cosFunction, tanFunction, asinFunction, acosFunction, atanFunction,
  sinhFunction, coshFunction, tanhFunction, asinhFunction, acoshFunction, atanhFunction,
  sqrtFunction, cbrtFunction, logFunction, lnFunction, log10Function, log2Function, lgFunction, log1pFunction,
  expFunction, expm1Function, absFunction, ceilFunction, floorFunction, roundFunction, truncFunction,
  signFunction, minFunction, maxFunction, randomFunction, lengthFunction,
].forEach((op) => operatorRegistry.register(op));

const buildVariablesContext = (context: WorkflowContext): Record<string, unknown> => {
  const variables: Record<string, unknown> = {
    event: context.event.payload,
    input: context.input ?? {},
    output: context.outputs,
    ...context.variables,
  };

  console.log('[ExpressionEngine] Contexto de variáveis:', JSON.stringify(variables, null, 2));
  return variables;
};

const buildFunctionsContext = (context: WorkflowContext): Record<string, (...args: unknown[]) => unknown> => {
  const functions: Record<string, (...args: unknown[]) => unknown> = {};

  const allFunctions = expressionFunctions.getAllDefinitions();
  allFunctions.forEach((fnDef) => {
    const fn = expressionFunctions.resolve(fnDef.name);
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

      const parser = new Parser(
        { 
          allowMemberAccess: true,
          operators: {
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
                    round: true,
                    trunc: true,
                    exp: true,
                    length: true,
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
                    fndef: false
                  }
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
      console.log('[ExpressionEngine] Resultado da avaliação:', result);
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
