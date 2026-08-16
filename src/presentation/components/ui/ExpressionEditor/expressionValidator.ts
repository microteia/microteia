import { Parser } from 'expr-eval';
import type { TranslateFn } from '../../../shared/i18n/useT';
import type { ExpressionFunctionDef } from '../../../../stores/useExpressionFunctions';

export interface ValidationResult {
  isValid: boolean | null;
  message?: string;
}

interface FunctionSignature {
  name: string;
  minArgs: number;
  maxArgs?: number;
}

const countFunctionArguments = (expression: string, openParenIndex: number): number => {
  let depth = 0;
  let argCount = 0;
  let hasContent = false;

  for (let i = openParenIndex + 1; i < expression.length; i += 1) {
    const char = expression[i];

    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      if (depth === 0) {
        return hasContent ? argCount + 1 : 0;
      }
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      argCount += 1;
      hasContent = false;
    } else if (char.trim() !== '') {
      hasContent = true;
    }
  }

  return -1;
};

export const validateExpressionWithParser = (
  t: TranslateFn,
  expression: string,
  availableFunctionDefs: ExpressionFunctionDef[],
): ValidationResult => {
  if (!expression.trim()) {
    return { isValid: true };
  }

  // Constrói mapa de signatures dinâmico a partir dos dados do backend
  const functionSignatures: Record<string, FunctionSignature> = {};
  availableFunctionDefs.forEach((fn) => {
    functionSignatures[fn.name] = {
      name: fn.name,
      minArgs: fn.minArgs,
      maxArgs: fn.maxArgs,
    };
  });

  // Validações pré-parser para mensagens mais amigáveis
  const openParens = (expression.match(/\(/g) || []).length;
  const closeParens = (expression.match(/\)/g) || []).length;
  
  if (openParens > closeParens) {
    return {
      isValid: false,
      message: t('expression.error.unclosed-paren', { count: openParens - closeParens }),
    };
  }

  if (closeParens > openParens) {
    return {
      isValid: false,
      message: t('expression.error.unopened-paren', { count: closeParens - openParens }),
    };
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
    return {
      isValid: false,
      message: stringChar === '"'
        ? '@core.automation/expr.unclosed-double-quote'
        : '@core.automation/expr.unclosed-single-quote',
    };
  }

  try {
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
                    // `round` é função (aceita casas decimais), não operador — ver mathFns.ts
                    round: false,
                    trunc: true,
                    exp: true,
                    // `length` é função (trata vazio como 0), não operador — ver stringFns.ts
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
                    fndef: false
                  } 
        });
    
    availableFunctionDefs.forEach((fn) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (parser.functions as any)[fn.name] = () => null;
    });

    parser.parse(expression);

    const functionPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    let match: RegExpExecArray | null = functionPattern.exec(expression);

    while (match !== null) {
      const fnName = match[1];
      const signature = functionSignatures[fnName];

      if (!signature) {
        // Função não tem signature - verifica se está na lista de disponíveis
        if (!availableFunctionDefs.some(f => f.name === fnName)) {
          return {
            isValid: false,
            message: t('expression.error.unknown-function', { name: fnName }),
          };
        }
        // Função está disponível mas não tem minArgs/maxArgs - pula validação de args
        match = functionPattern.exec(expression);
        continue;
      }

      const argCount = countFunctionArguments(expression, match.index + match[0].length - 1);

      if (argCount < 0) {
        return {
          isValid: false,
          message: t('expression.error.function-unclosed', { name: fnName }),
        };
      }

      if (argCount < signature.minArgs) {
        return {
          isValid: false,
          message: t('expression.error.min-args', { name: fnName, count: signature.minArgs, received: argCount }),
        };
      }

      if (signature.maxArgs != null && argCount > signature.maxArgs) {
        return {
          isValid: false,
          message: t('expression.error.max-args', { name: fnName, count: signature.maxArgs, received: argCount }),
        };
      }

      match = functionPattern.exec(expression);
    }

    return { isValid: true, message: t('expression.valid') };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Erros comuns do expr-eval traduzidos para mensagens amigáveis
    if (errorMessage.includes('TEOF') || errorMessage.includes('EOF')) {
      return {
        isValid: false,
        message: t('expression.error.incomplete'),
      };
    }

    if (errorMessage.includes('unexpected TNAME')) {
      return {
        isValid: false,
        message: t('expression.error.unexpected-name'),
      };
    }

    if (errorMessage.includes('unexpected TNUMBER')) {
      return {
        isValid: false,
        message: t('expression.error.unexpected-number'),
      };
    }

    if (errorMessage.includes('unexpected TSTRING')) {
      return {
        isValid: false,
        message: t('expression.error.unexpected-text'),
      };
    }

    if (errorMessage.includes('unexpected TCOMMA')) {
      return {
        isValid: false,
        message: t('expression.error.unexpected-comma'),
      };
    }

    if (errorMessage.includes('parse error')) {
      return {
        isValid: false,
        message: t('expression.error.syntax'),
      };
    }
    
    if (errorMessage.includes('unexpected')) {
      const token = errorMessage.match(/unexpected\s+(\w+)/)?.[1];
      if (token) {
        return {
          isValid: false,
          message: t('expression.error.unexpected-symbol', { token }),
        };
      }
      return {
        isValid: false,
        message: t('expression.error.syntax'),
      };
    }

    return { isValid: false, message: errorMessage };
  }
};
