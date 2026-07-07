import type { ExpressionFunction } from '../FunctionRegistry';

export const andFn: ExpressionFunction = {
  name: 'and',
  call: (args) => args.every((arg) => Boolean(arg)),
  description: 'Retorna verdadeiro se todos os argumentos forem verdadeiros',
  signature: 'and(condição1, condição2, ...)',
  example: 'and(5 > 3, 10 < 20)',
  category: 'Condicional',
};

export const orFn: ExpressionFunction = {
  name: 'or',
  call: (args) => args.some((arg) => Boolean(arg)),
  description: 'Retorna verdadeiro se pelo menos um argumento for verdadeiro',
  signature: 'or(condição1, condição2, ...)',
  example: 'or(5 > 10, 10 < 20)',
  category: 'Condicional',
};

export const notFn: ExpressionFunction = {
  name: 'not',
  call: ([value]) => !value,
  description: 'Inverte um valor booleano',
  signature: 'not(valor)',
  example: 'not(5 > 10)',
  category: 'Condicional',
};

export const isEmptyFn: ExpressionFunction = {
  name: 'isEmpty',
  call: ([value]) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  },
  description: 'Verifica se um valor está vazio (null, undefined, string vazia, array vazio, objeto vazio)',
  signature: 'isEmpty(valor)',
  example: 'isEmpty("")',
  category: 'Condicional',
};

export const isNullFn: ExpressionFunction = {
  name: 'isNull',
  call: ([value]) => value === null || value === undefined,
  description: 'Verifica se um valor é nulo ou indefinido',
  signature: 'isNull(valor)',
  example: 'isNull(event.optionalField)',
  category: 'Condicional',
};

export const isNotNullFn: ExpressionFunction = {
  name: 'isNotNull',
  call: ([value]) => value !== null && value !== undefined,
  description: 'Verifica se um valor não é nulo nem indefinido',
  signature: 'isNotNull(valor)',
  example: 'isNotNull(event.name)',
  category: 'Condicional',
};

export const coalesceFn: ExpressionFunction = {
  name: 'coalesce',
  call: (args) => {
    for (const arg of args) {
      if (arg !== null && arg !== undefined) {
        return arg;
      }
    }
    return null;
  },
  description: 'Retorna o primeiro valor não-nulo/não-indefinido entre os argumentos',
  signature: 'coalesce(valor1, valor2, ...)',
  example: 'coalesce(event.name, "Sem nome")',
  category: 'Condicional',
};
