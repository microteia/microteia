import type { ExpressionFunction } from '../FunctionRegistry';

export const concatFn: ExpressionFunction = {
  name: 'concat',
  call: (args) => args.map((arg) => String(arg)).join(''),
  description: 'Concatena valores em uma string',
  signature: 'concat(valor1, valor2, ...)',
  example: 'concat("Processo ", "123")',
  category: 'Texto',
};

export const lowerFn: ExpressionFunction = {
  name: 'lower',
  call: ([value]) => String(value).toLowerCase(),
  description: 'Converte texto para minúsculas',
  signature: 'lower(texto)',
  example: 'lower("TEXTO")',
  category: 'Texto',
};

export const upperFn: ExpressionFunction = {
  name: 'upper',
  call: ([value]) => String(value).toUpperCase(),
  description: 'Converte texto para MAIÚSCULAS',
  signature: 'upper(texto)',
  example: 'upper("texto")',
  category: 'Texto',
};

export const lengthFn: ExpressionFunction = {
  name: 'length',
  call: ([value]) => {
    if (typeof value === 'string' || Array.isArray(value)) return value.length;
    return 0;
  },
  description: 'Retorna o tamanho de um texto ou array',
  signature: 'length(valor)',
  example: 'length("texto")',
  category: 'Texto',
};
