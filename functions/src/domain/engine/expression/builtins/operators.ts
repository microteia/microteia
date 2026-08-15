import type { ExpressionOperator } from '../OperatorRegistry';

// ==================== OPERADORES ARITMÉTICOS ====================

export const addOperator: ExpressionOperator = {
  symbol: '+',
  name: '@core.automation/expr.add.name',
  description: '@core.automation/expr.add.description',
  usage: 'a + b',
  example: '10 + 5 → 15',
  category: '@core.automation/expr.category.arithmetic',
};

export const subtractOperator: ExpressionOperator = {
  symbol: '-',
  name: '@core.automation/expr.subtract.name',
  description: '@core.automation/expr.subtract.description',
  usage: 'a - b',
  example: '10 - 3 → 7',
  category: '@core.automation/expr.category.arithmetic',
};

export const multiplyOperator: ExpressionOperator = {
  symbol: '*',
  name: '@core.automation/expr.multiply.name',
  description: '@core.automation/expr.multiply.description',
  usage: 'a * b',
  example: '4 * 5 → 20',
  category: '@core.automation/expr.category.arithmetic',
};

export const divideOperator: ExpressionOperator = {
  symbol: '/',
  name: '@core.automation/expr.divide.name',
  description: '@core.automation/expr.divide.description',
  usage: 'a / b',
  example: '20 / 4 → 5',
  category: '@core.automation/expr.category.arithmetic',
};

export const remainderOperator: ExpressionOperator = {
  symbol: '%',
  name: 'Resto da Divisão',
  description: '@core.automation/expr.remainder.description',
  usage: 'a % b',
  example: '10 % 3 → 1',
  category: '@core.automation/expr.category.arithmetic',
};

export const powerOperator: ExpressionOperator = {
  symbol: '^',
  name: '@core.automation/expr.power.name',
  description: '@core.automation/expr.power.description',
  usage: 'a ^ b',
  example: '2 ^ 3 → 8',
  category: '@core.automation/expr.category.arithmetic',
};

export const factorialOperator: ExpressionOperator = {
  symbol: '!',
  name: '@core.automation/expr.factorial.name',
  description: '@core.automation/expr.factorial.description',
  usage: 'n!',
  example: '5! → 120',
  category: '@core.automation/expr.category.arithmetic',
};

// ==================== OPERADORES DE COMPARAÇÃO ====================

export const equalOperator: ExpressionOperator = {
  symbol: '==',
  name: 'Igual a',
  description: '@core.automation/expr.equal.description',
  usage: 'a == b',
  example: '5 == 5 → true',
  category: '@core.automation/expr.category.comparison',
};

export const notEqualOperator: ExpressionOperator = {
  symbol: '!=',
  name: 'Diferente de',
  description: '@core.automation/expr.notEqual.description',
  usage: 'a != b',
  example: '5 != 3 → true',
  category: '@core.automation/expr.category.comparison',
};

export const lessThanOperator: ExpressionOperator = {
  symbol: '<',
  name: '@core.automation/expr.lessThan.name',
  description: '@core.automation/expr.lessThan.description',
  usage: 'a < b',
  example: '3 < 5 → true',
  category: '@core.automation/expr.category.comparison',
};

export const lessOrEqualOperator: ExpressionOperator = {
  symbol: '<=',
  name: 'Menor ou igual a',
  description: '@core.automation/expr.lessOrEqual.description',
  usage: 'a <= b',
  example: '5 <= 5 → true',
  category: '@core.automation/expr.category.comparison',
};

export const greaterThanOperator: ExpressionOperator = {
  symbol: '>',
  name: '@core.automation/expr.greaterThan.name',
  description: '@core.automation/expr.greaterThan.description',
  usage: 'a > b',
  example: '10 > 5 → true',
  category: '@core.automation/expr.category.comparison',
};

export const greaterOrEqualOperator: ExpressionOperator = {
  symbol: '>=',
  name: 'Maior ou igual a',
  description: '@core.automation/expr.greaterOrEqual.description',
  usage: 'a >= b',
  example: '10 >= 10 → true',
  category: '@core.automation/expr.category.comparison',
};

// ==================== OPERADORES LÓGICOS ====================

export const andOperator: ExpressionOperator = {
  symbol: 'and',
  name: '@core.automation/expr.and.name',
  description: '@core.automation/expr.and.description',
  usage: 'a and b',
  example: '(5 > 3) and (2 < 4) → true',
  category: '@core.automation/expr.category.logical',
};

export const orOperator: ExpressionOperator = {
  symbol: 'or',
  name: 'OU lógico',
  description: '@core.automation/expr.or.description',
  usage: 'a or b',
  example: '(5 < 3) or (2 < 4) → true',
  category: '@core.automation/expr.category.logical',
};

export const notOperatorSymbol: ExpressionOperator = {
  symbol: 'not',
  name: 'NÃO lógico',
  description: '@core.automation/expr.notOperatorSymbol.description',
  usage: 'not a',
  example: 'not (5 > 3) → false',
  category: '@core.automation/expr.category.logical',
};

// ==================== OPERADOR CONDICIONAL ====================

export const ternaryOperator: ExpressionOperator = {
  symbol: '? :',
  name: 'Condicional (Ternário)',
  description: '@core.automation/expr.ternary.description',
  usage: 'condition ? valueIfTrue : valueIfFalse',
  example: '(idade >= 18) ? "Maior" : "Menor"',
  category: '@core.automation/expr.category.conditional',
};

// ==================== OPERADOR DE CONCATENAÇÃO ====================

export const concatenateOperator: ExpressionOperator = {
  symbol: '||',
  name: '@core.automation/expr.concatenate.name',
  description: '@core.automation/expr.concatenate.description',
  usage: 'a || b',
  example: '"Hello" || " " || "World" → "Hello World"',
  category: '@core.automation/expr.category.text',
};

// ==================== OPERADOR IN ====================

export const inOperator: ExpressionOperator = {
  symbol: 'in',
  name: '@core.automation/expr.in.name',
  description: '@core.automation/expr.in.description',
  usage: 'value in array',
  example: '5 in [1, 5, 10] → true',
  category: '@core.automation/expr.category.operator',
};

// ==================== FUNÇÕES MATEMÁTICAS BUILT-IN ====================

export const sinFunction: ExpressionOperator = {
  symbol: 'sin',
  name: '@core.automation/expr.sinFunction.name',
  description: '@core.automation/expr.sinFunction.description',
  usage: 'sin(angle)',
  example: 'sin(0) → 0',
  category: '@core.automation/expr.category.math',
};

export const cosFunction: ExpressionOperator = {
  symbol: 'cos',
  name: '@core.automation/expr.cosFunction.name',
  description: '@core.automation/expr.cosFunction.description',
  usage: 'cos(angle)',
  example: 'cos(0) → 1',
  category: '@core.automation/expr.category.math',
};

export const tanFunction: ExpressionOperator = {
  symbol: 'tan',
  name: '@core.automation/expr.tanFunction.name',
  description: '@core.automation/expr.tanFunction.description',
  usage: 'tan(angle)',
  example: 'tan(0) → 0',
  category: '@core.automation/expr.category.math',
};

export const asinFunction: ExpressionOperator = {
  symbol: 'asin',
  name: 'Arco Seno',
  description: '@core.automation/expr.asinFunction.description',
  usage: 'asin(value)',
  example: 'asin(0) → 0',
  category: '@core.automation/expr.category.math',
};

export const acosFunction: ExpressionOperator = {
  symbol: 'acos',
  name: 'Arco Cosseno',
  description: '@core.automation/expr.acosFunction.description',
  usage: 'acos(value)',
  example: 'acos(1) → 0',
  category: '@core.automation/expr.category.math',
};

export const atanFunction: ExpressionOperator = {
  symbol: 'atan',
  name: 'Arco Tangente',
  description: '@core.automation/expr.atanFunction.description',
  usage: 'atan(value)',
  example: 'atan(0) → 0',
  category: '@core.automation/expr.category.math',
};

export const sinhFunction: ExpressionOperator = {
  symbol: 'sinh',
  name: 'Seno Hiperbólico',
  description: '@core.automation/expr.sinhFunction.description',
  usage: 'sinh(value)',
  example: 'sinh(0) → 0',
  category: '@core.automation/expr.category.math',
};

export const coshFunction: ExpressionOperator = {
  symbol: 'cosh',
  name: 'Cosseno Hiperbólico',
  description: '@core.automation/expr.coshFunction.description',
  usage: 'cosh(value)',
  example: 'cosh(0) → 1',
  category: '@core.automation/expr.category.math',
};

export const tanhFunction: ExpressionOperator = {
  symbol: 'tanh',
  name: 'Tangente Hiperbólica',
  description: '@core.automation/expr.tanhFunction.description',
  usage: 'tanh(value)',
  example: 'tanh(0) → 0',
  category: '@core.automation/expr.category.math',
};

export const asinhFunction: ExpressionOperator = {
  symbol: 'asinh',
  name: 'Arco Seno Hiperbólico',
  description: '@core.automation/expr.asinhFunction.description',
  usage: 'asinh(value)',
  example: 'asinh(0) → 0',
  category: '@core.automation/expr.category.math',
};

export const acoshFunction: ExpressionOperator = {
  symbol: 'acosh',
  name: 'Arco Cosseno Hiperbólico',
  description: '@core.automation/expr.acoshFunction.description',
  usage: 'acosh(value)',
  example: 'acosh(1) → 0',
  category: '@core.automation/expr.category.math',
};

export const atanhFunction: ExpressionOperator = {
  symbol: 'atanh',
  name: 'Arco Tangente Hiperbólica',
  description: '@core.automation/expr.atanhFunction.description',
  usage: 'atanh(value)',
  example: 'atanh(0) → 0',
  category: '@core.automation/expr.category.math',
};

export const sqrtFunction: ExpressionOperator = {
  symbol: 'sqrt',
  name: 'Raiz Quadrada',
  description: '@core.automation/expr.sqrtFunction.description',
  usage: 'sqrt(number)',
  example: 'sqrt(16) → 4',
  category: '@core.automation/expr.category.math',
};

export const cbrtFunction: ExpressionOperator = {
  symbol: 'cbrt',
  name: 'Raiz Cúbica',
  description: '@core.automation/expr.cbrtFunction.description',
  usage: 'cbrt(number)',
  example: 'cbrt(27) → 3',
  category: '@core.automation/expr.category.math',
};

export const logFunction: ExpressionOperator = {
  symbol: 'log',
  name: 'Logaritmo Natural (ln)',
  description: '@core.automation/expr.logFunction.description',
  usage: 'log(number)',
  example: 'log(2.718281828459045) → 1',
  category: '@core.automation/expr.category.math',
};

export const lnFunction: ExpressionOperator = {
  symbol: 'ln',
  name: 'Logaritmo Natural',
  description: '@core.automation/expr.lnFunction.description',
  usage: 'ln(number)',
  example: 'ln(2.718281828459045) → 1',
  category: '@core.automation/expr.category.math',
};

export const log10Function: ExpressionOperator = {
  symbol: 'log10',
  name: 'Logaritmo Base 10',
  description: '@core.automation/expr.log10Function.description',
  usage: 'log10(number)',
  example: 'log10(100) → 2',
  category: '@core.automation/expr.category.math',
};

export const log2Function: ExpressionOperator = {
  symbol: 'log2',
  name: 'Logaritmo Base 2',
  description: '@core.automation/expr.log2Function.description',
  usage: 'log2(number)',
  example: 'log2(8) → 3',
  category: '@core.automation/expr.category.math',
};

export const lgFunction: ExpressionOperator = {
  symbol: 'lg',
  name: 'Logaritmo Base 10 (lg)',
  description: '@core.automation/expr.lgFunction.description',
  usage: 'lg(number)',
  example: 'lg(1000) → 3',
  category: '@core.automation/expr.category.math',
};

export const log1pFunction: ExpressionOperator = {
  symbol: 'log1p',
  name: 'Logaritmo de 1 + x',
  description: '@core.automation/expr.log1pFunction.description',
  usage: 'log1p(number)',
  example: 'log1p(0) → 0',
  category: '@core.automation/expr.category.math',
};

export const expFunction: ExpressionOperator = {
  symbol: 'exp',
  name: '@core.automation/expr.expFunction.name',
  description: '@core.automation/expr.expFunction.description',
  usage: 'exp(number)',
  example: 'exp(1) → 2.718281828459045',
  category: '@core.automation/expr.category.math',
};

export const expm1Function: ExpressionOperator = {
  symbol: 'expm1',
  name: 'Exponencial menos 1',
  description: '@core.automation/expr.expm1Function.description',
  usage: 'expm1(number)',
  example: 'expm1(0) → 0',
  category: '@core.automation/expr.category.math',
};

export const absFunction: ExpressionOperator = {
  symbol: 'abs',
  name: 'Valor Absoluto',
  description: '@core.automation/expr.absFunction.description',
  usage: 'abs(number)',
  example: 'abs(-5) → 5',
  category: '@core.automation/expr.category.math',
};

export const ceilFunction: ExpressionOperator = {
  symbol: 'ceil',
  name: 'Arredondar para Cima',
  description: '@core.automation/expr.ceilFunction.description',
  usage: 'ceil(number)',
  example: 'ceil(4.3) → 5',
  category: '@core.automation/expr.category.math',
};

/**
 * `round` e `length` NÃO são documentados como operadores: são FUNÇÕES de verdade (`roundFn` em
 * `mathFns.ts`, `lengthFn` em `stringFns.ts`), porque só assim aceitam as casas decimais e tratam o
 * campo vazio como 0. Documentá-los aqui também duplicaria a entrada no editor, e a versão sem
 * `minArgs`/`maxArgs` venceria — desligando a checagem de argumentos.
 */
export const floorFunction: ExpressionOperator = {
  symbol: 'floor',
  name: 'Arredondar para Baixo',
  description: '@core.automation/expr.floorFunction.description',
  usage: 'floor(number)',
  example: 'floor(4.9) → 4',
  category: '@core.automation/expr.category.math',
};

export const truncFunction: ExpressionOperator = {
  symbol: 'trunc',
  name: '@core.automation/expr.truncFunction.name',
  description: '@core.automation/expr.truncFunction.description',
  usage: 'trunc(number)',
  example: 'trunc(4.9) → 4',
  category: '@core.automation/expr.category.math',
};

export const signFunction: ExpressionOperator = {
  symbol: 'sign',
  name: '@core.automation/expr.signFunction.name',
  description: '@core.automation/expr.signFunction.description',
  usage: 'sign(number)',
  example: 'sign(-5) → -1',
  category: '@core.automation/expr.category.math',
};

export const minFunction: ExpressionOperator = {
  symbol: 'min',
  name: '@core.automation/expr.minFunction.name',
  description: '@core.automation/expr.minFunction.description',
  usage: 'min(a, b, c, ...)',
  example: 'min(5, 2, 8) → 2',
  category: '@core.automation/expr.category.math',
};

export const maxFunction: ExpressionOperator = {
  symbol: 'max',
  name: '@core.automation/expr.maxFunction.name',
  description: '@core.automation/expr.maxFunction.description',
  usage: 'max(a, b, c, ...)',
  example: 'max(5, 2, 8) → 8',
  category: '@core.automation/expr.category.math',
};

export const randomFunction: ExpressionOperator = {
  symbol: 'random',
  name: 'Número Aleatório',
  description: '@core.automation/expr.randomFunction.description',
  usage: 'random(max?)',
  example: 'random(10) → a number between 0 and 10',
  category: '@core.automation/expr.category.math',
};

