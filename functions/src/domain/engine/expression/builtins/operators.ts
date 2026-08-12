import type { ExpressionOperator } from '../OperatorRegistry';

// ==================== OPERADORES ARITMÉTICOS ====================

export const addOperator: ExpressionOperator = {
  symbol: '+',
  name: 'Adição',
  description: 'Soma dois números',
  usage: 'a + b',
  example: '10 + 5 → 15',
  category: 'Aritmético',
};

export const subtractOperator: ExpressionOperator = {
  symbol: '-',
  name: 'Subtração',
  description: 'Subtrai o segundo número do primeiro',
  usage: 'a - b',
  example: '10 - 3 → 7',
  category: 'Aritmético',
};

export const multiplyOperator: ExpressionOperator = {
  symbol: '*',
  name: 'Multiplicação',
  description: 'Multiplica dois números',
  usage: 'a * b',
  example: '4 * 5 → 20',
  category: 'Aritmético',
};

export const divideOperator: ExpressionOperator = {
  symbol: '/',
  name: 'Divisão',
  description: 'Divide o primeiro número pelo segundo',
  usage: 'a / b',
  example: '20 / 4 → 5',
  category: 'Aritmético',
};

export const remainderOperator: ExpressionOperator = {
  symbol: '%',
  name: 'Resto da Divisão',
  description: 'Retorna o resto da divisão inteira',
  usage: 'a % b',
  example: '10 % 3 → 1',
  category: 'Aritmético',
};

export const powerOperator: ExpressionOperator = {
  symbol: '^',
  name: 'Potência',
  description: 'Eleva o primeiro número à potência do segundo',
  usage: 'a ^ b',
  example: '2 ^ 3 → 8',
  category: 'Aritmético',
};

export const factorialOperator: ExpressionOperator = {
  symbol: '!',
  name: 'Fatorial',
  description: 'Calcula o fatorial de um número (use com cuidado: apenas inteiros pequenos)',
  usage: 'n!',
  example: '5! → 120',
  category: 'Aritmético',
};

// ==================== OPERADORES DE COMPARAÇÃO ====================

export const equalOperator: ExpressionOperator = {
  symbol: '==',
  name: 'Igual a',
  description: 'Verifica se dois valores são iguais',
  usage: 'a == b',
  example: '5 == 5 → true',
  category: 'Comparação',
};

export const notEqualOperator: ExpressionOperator = {
  symbol: '!=',
  name: 'Diferente de',
  description: 'Verifica se dois valores são diferentes',
  usage: 'a != b',
  example: '5 != 3 → true',
  category: 'Comparação',
};

export const lessThanOperator: ExpressionOperator = {
  symbol: '<',
  name: 'Menor que',
  description: 'Verifica se o primeiro valor é menor que o segundo',
  usage: 'a < b',
  example: '3 < 5 → true',
  category: 'Comparação',
};

export const lessOrEqualOperator: ExpressionOperator = {
  symbol: '<=',
  name: 'Menor ou igual a',
  description: 'Verifica se o primeiro valor é menor ou igual ao segundo',
  usage: 'a <= b',
  example: '5 <= 5 → true',
  category: 'Comparação',
};

export const greaterThanOperator: ExpressionOperator = {
  symbol: '>',
  name: 'Maior que',
  description: 'Verifica se o primeiro valor é maior que o segundo',
  usage: 'a > b',
  example: '10 > 5 → true',
  category: 'Comparação',
};

export const greaterOrEqualOperator: ExpressionOperator = {
  symbol: '>=',
  name: 'Maior ou igual a',
  description: 'Verifica se o primeiro valor é maior ou igual ao segundo',
  usage: 'a >= b',
  example: '10 >= 10 → true',
  category: 'Comparação',
};

// ==================== OPERADORES LÓGICOS ====================

export const andOperator: ExpressionOperator = {
  symbol: 'and',
  name: 'E lógico',
  description: 'Retorna true se ambas as condições forem verdadeiras',
  usage: 'a and b',
  example: '(5 > 3) and (2 < 4) → true',
  category: 'Lógico',
};

export const orOperator: ExpressionOperator = {
  symbol: 'or',
  name: 'OU lógico',
  description: 'Retorna true se pelo menos uma condição for verdadeira',
  usage: 'a or b',
  example: '(5 < 3) or (2 < 4) → true',
  category: 'Lógico',
};

export const notOperatorSymbol: ExpressionOperator = {
  symbol: 'not',
  name: 'NÃO lógico',
  description: 'Inverte o valor booleano',
  usage: 'not a',
  example: 'not (5 > 3) → false',
  category: 'Lógico',
};

// ==================== OPERADOR CONDICIONAL ====================

export const ternaryOperator: ExpressionOperator = {
  symbol: '? :',
  name: 'Condicional (Ternário)',
  description: 'Retorna um valor se a condição for verdadeira, outro se for falsa',
  usage: 'condição ? valor_se_true : valor_se_false',
  example: '(idade >= 18) ? "Maior" : "Menor"',
  category: 'Condicional',
};

// ==================== OPERADOR DE CONCATENAÇÃO ====================

export const concatenateOperator: ExpressionOperator = {
  symbol: '||',
  name: 'Concatenação',
  description: 'Concatena dois valores como texto (alternativa ao concat())',
  usage: 'a || b',
  example: '"Olá" || " " || "Mundo" → "Olá Mundo"',
  category: 'Texto',
};

// ==================== OPERADOR IN ====================

export const inOperator: ExpressionOperator = {
  symbol: 'in',
  name: 'Pertence a',
  description: 'Verifica se um valor está presente em um array',
  usage: 'valor in array',
  example: '5 in [1, 5, 10] → true',
  category: 'Operador',
};

// ==================== FUNÇÕES MATEMÁTICAS BUILT-IN ====================

export const sinFunction: ExpressionOperator = {
  symbol: 'sin',
  name: 'Seno',
  description: 'Calcula o seno de um ângulo em radianos',
  usage: 'sin(ângulo)',
  example: 'sin(0) → 0',
  category: 'Matemática',
};

export const cosFunction: ExpressionOperator = {
  symbol: 'cos',
  name: 'Cosseno',
  description: 'Calcula o cosseno de um ângulo em radianos',
  usage: 'cos(ângulo)',
  example: 'cos(0) → 1',
  category: 'Matemática',
};

export const tanFunction: ExpressionOperator = {
  symbol: 'tan',
  name: 'Tangente',
  description: 'Calcula a tangente de um ângulo em radianos',
  usage: 'tan(ângulo)',
  example: 'tan(0) → 0',
  category: 'Matemática',
};

export const asinFunction: ExpressionOperator = {
  symbol: 'asin',
  name: 'Arco Seno',
  description: 'Calcula o arco seno (inverso do seno)',
  usage: 'asin(valor)',
  example: 'asin(0) → 0',
  category: 'Matemática',
};

export const acosFunction: ExpressionOperator = {
  symbol: 'acos',
  name: 'Arco Cosseno',
  description: 'Calcula o arco cosseno (inverso do cosseno)',
  usage: 'acos(valor)',
  example: 'acos(1) → 0',
  category: 'Matemática',
};

export const atanFunction: ExpressionOperator = {
  symbol: 'atan',
  name: 'Arco Tangente',
  description: 'Calcula o arco tangente (inverso da tangente)',
  usage: 'atan(valor)',
  example: 'atan(0) → 0',
  category: 'Matemática',
};

export const sinhFunction: ExpressionOperator = {
  symbol: 'sinh',
  name: 'Seno Hiperbólico',
  description: 'Calcula o seno hiperbólico',
  usage: 'sinh(valor)',
  example: 'sinh(0) → 0',
  category: 'Matemática',
};

export const coshFunction: ExpressionOperator = {
  symbol: 'cosh',
  name: 'Cosseno Hiperbólico',
  description: 'Calcula o cosseno hiperbólico',
  usage: 'cosh(valor)',
  example: 'cosh(0) → 1',
  category: 'Matemática',
};

export const tanhFunction: ExpressionOperator = {
  symbol: 'tanh',
  name: 'Tangente Hiperbólica',
  description: 'Calcula a tangente hiperbólica',
  usage: 'tanh(valor)',
  example: 'tanh(0) → 0',
  category: 'Matemática',
};

export const asinhFunction: ExpressionOperator = {
  symbol: 'asinh',
  name: 'Arco Seno Hiperbólico',
  description: 'Calcula o arco seno hiperbólico',
  usage: 'asinh(valor)',
  example: 'asinh(0) → 0',
  category: 'Matemática',
};

export const acoshFunction: ExpressionOperator = {
  symbol: 'acosh',
  name: 'Arco Cosseno Hiperbólico',
  description: 'Calcula o arco cosseno hiperbólico',
  usage: 'acosh(valor)',
  example: 'acosh(1) → 0',
  category: 'Matemática',
};

export const atanhFunction: ExpressionOperator = {
  symbol: 'atanh',
  name: 'Arco Tangente Hiperbólica',
  description: 'Calcula o arco tangente hiperbólica',
  usage: 'atanh(valor)',
  example: 'atanh(0) → 0',
  category: 'Matemática',
};

export const sqrtFunction: ExpressionOperator = {
  symbol: 'sqrt',
  name: 'Raiz Quadrada',
  description: 'Calcula a raiz quadrada de um número',
  usage: 'sqrt(número)',
  example: 'sqrt(16) → 4',
  category: 'Matemática',
};

export const cbrtFunction: ExpressionOperator = {
  symbol: 'cbrt',
  name: 'Raiz Cúbica',
  description: 'Calcula a raiz cúbica de um número',
  usage: 'cbrt(número)',
  example: 'cbrt(27) → 3',
  category: 'Matemática',
};

export const logFunction: ExpressionOperator = {
  symbol: 'log',
  name: 'Logaritmo Natural (ln)',
  description: 'Calcula o logaritmo natural (base e)',
  usage: 'log(número)',
  example: 'log(2.718281828459045) → 1',
  category: 'Matemática',
};

export const lnFunction: ExpressionOperator = {
  symbol: 'ln',
  name: 'Logaritmo Natural',
  description: 'Calcula o logaritmo natural (base e) - alias para log',
  usage: 'ln(número)',
  example: 'ln(2.718281828459045) → 1',
  category: 'Matemática',
};

export const log10Function: ExpressionOperator = {
  symbol: 'log10',
  name: 'Logaritmo Base 10',
  description: 'Calcula o logaritmo na base 10',
  usage: 'log10(número)',
  example: 'log10(100) → 2',
  category: 'Matemática',
};

export const log2Function: ExpressionOperator = {
  symbol: 'log2',
  name: 'Logaritmo Base 2',
  description: 'Calcula o logaritmo na base 2',
  usage: 'log2(número)',
  example: 'log2(8) → 3',
  category: 'Matemática',
};

export const lgFunction: ExpressionOperator = {
  symbol: 'lg',
  name: 'Logaritmo Base 10 (lg)',
  description: 'Calcula o logaritmo na base 10 - alias para log10',
  usage: 'lg(número)',
  example: 'lg(1000) → 3',
  category: 'Matemática',
};

export const log1pFunction: ExpressionOperator = {
  symbol: 'log1p',
  name: 'Logaritmo de 1 + x',
  description: 'Calcula log(1 + x) com precisão para valores pequenos de x',
  usage: 'log1p(número)',
  example: 'log1p(0) → 0',
  category: 'Matemática',
};

export const expFunction: ExpressionOperator = {
  symbol: 'exp',
  name: 'Exponencial',
  description: 'Calcula e elevado à potência do número (e^x)',
  usage: 'exp(número)',
  example: 'exp(1) → 2.718281828459045',
  category: 'Matemática',
};

export const expm1Function: ExpressionOperator = {
  symbol: 'expm1',
  name: 'Exponencial menos 1',
  description: 'Calcula e^x - 1 com precisão para valores pequenos de x',
  usage: 'expm1(número)',
  example: 'expm1(0) → 0',
  category: 'Matemática',
};

export const absFunction: ExpressionOperator = {
  symbol: 'abs',
  name: 'Valor Absoluto',
  description: 'Retorna o valor absoluto (sem sinal) de um número',
  usage: 'abs(número)',
  example: 'abs(-5) → 5',
  category: 'Matemática',
};

export const ceilFunction: ExpressionOperator = {
  symbol: 'ceil',
  name: 'Arredondar para Cima',
  description: 'Arredonda um número para cima (próximo inteiro maior)',
  usage: 'ceil(número)',
  example: 'ceil(4.3) → 5',
  category: 'Matemática',
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
  description: 'Arredonda um número para baixo (próximo inteiro menor)',
  usage: 'floor(número)',
  example: 'floor(4.9) → 4',
  category: 'Matemática',
};

export const truncFunction: ExpressionOperator = {
  symbol: 'trunc',
  name: 'Truncar',
  description: 'Remove a parte decimal de um número',
  usage: 'trunc(número)',
  example: 'trunc(4.9) → 4',
  category: 'Matemática',
};

export const signFunction: ExpressionOperator = {
  symbol: 'sign',
  name: 'Sinal',
  description: 'Retorna -1 para negativos, 0 para zero, 1 para positivos',
  usage: 'sign(número)',
  example: 'sign(-5) → -1',
  category: 'Matemática',
};

export const minFunction: ExpressionOperator = {
  symbol: 'min',
  name: 'Mínimo',
  description: 'Retorna o menor valor entre vários números',
  usage: 'min(a, b, c, ...)',
  example: 'min(5, 2, 8) → 2',
  category: 'Matemática',
};

export const maxFunction: ExpressionOperator = {
  symbol: 'max',
  name: 'Máximo',
  description: 'Retorna o maior valor entre vários números',
  usage: 'max(a, b, c, ...)',
  example: 'max(5, 2, 8) → 8',
  category: 'Matemática',
};

export const randomFunction: ExpressionOperator = {
  symbol: 'random',
  name: 'Número Aleatório',
  description: 'Gera um número aleatório entre 0 e o valor fornecido (ou entre 0 e 1 se sem argumentos)',
  usage: 'random(max?)',
  example: 'random(10) → número entre 0 e 10',
  category: 'Matemática',
};

