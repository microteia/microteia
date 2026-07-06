import type { WorkflowContext } from '../../entities/WorkflowContext';
import { expressionFunctions } from './FunctionRegistry';
import { todayFn, nowFn } from './builtins/dateFns';
import { ifFn } from './builtins/ifFn';
import { concatFn, lowerFn, upperFn, lengthFn } from './builtins/stringFns';

[todayFn, nowFn, ifFn, concatFn, lowerFn, upperFn, lengthFn].forEach((fn) => expressionFunctions.register(fn));

type TokenType = 'ident' | 'number' | 'string' | 'lparen' | 'rparen' | 'comma' | 'plus' | 'minus' | 'dot';

interface Token {
  type: TokenType;
  value: string;
}

const tokenize = (expression: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expression.length) {
    const char = expression[i];
    if (/\s/.test(char)) { i += 1; continue; }
    if (char === '(') { tokens.push({ type: 'lparen', value: char }); i += 1; continue; }
    if (char === ')') { tokens.push({ type: 'rparen', value: char }); i += 1; continue; }
    if (char === ',') { tokens.push({ type: 'comma', value: char }); i += 1; continue; }
    if (char === '+') { tokens.push({ type: 'plus', value: char }); i += 1; continue; }
    if (char === '-') { tokens.push({ type: 'minus', value: char }); i += 1; continue; }
    if (char === '"' || char === "'") {
      const quote = char;
      let j = i + 1;
      let value = '';
      while (j < expression.length && expression[j] !== quote) { value += expression[j]; j += 1; }
      tokens.push({ type: 'string', value });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(char)) {
      let j = i;
      let value = '';
      while (j < expression.length && /[0-9.]/.test(expression[j])) { value += expression[j]; j += 1; }
      tokens.push({ type: 'number', value });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(char)) {
      let j = i;
      let value = '';
      while (j < expression.length && /[a-zA-Z0-9_]/.test(expression[j])) { value += expression[j]; j += 1; }
      tokens.push({ type: 'ident', value });
      i = j;
      continue;
    }
    if (char === '.') { tokens.push({ type: 'dot', value: char }); i += 1; continue; }
    throw new Error(`Expressão inválida: caractere inesperado "${char}"`);
  }
  return tokens;
};

type Ast =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'call'; name: string; args: Ast[] }
  | { type: 'property'; path: string[] }
  | { type: 'binop'; op: '+' | '-'; left: Ast; right: Ast };

class Parser {
  private position = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private consume(type: TokenType): Token {
    const token = this.tokens[this.position];
    if (!token || token.type !== type) {
      throw new Error(`Expressão inválida: esperava "${type}"`);
    }
    this.position += 1;
    return token;
  }

  parseExpression(): Ast {
    let node = this.parseTerm();
    while (this.peek()?.type === 'plus' || this.peek()?.type === 'minus') {
      const op = this.consume(this.peek()!.type).type === 'plus' ? '+' : '-';
      const right = this.parseTerm();
      node = { type: 'binop', op, left: node, right };
    }
    return node;
  }

  private parseTerm(): Ast {
    const token = this.peek();
    if (!token) throw new Error('Expressão inválida: fim inesperado');

    if (token.type === 'number') {
      this.consume('number');
      return { type: 'number', value: Number(token.value) };
    }
    if (token.type === 'string') {
      this.consume('string');
      return { type: 'string', value: token.value };
    }
    if (token.type === 'ident') {
      const identName = token.value;
      this.consume('ident');

      if (this.peek()?.type === 'lparen') {
        this.consume('lparen');
        const args: Ast[] = [];
        if (this.peek()?.type !== 'rparen') {
          args.push(this.parseExpression());
          while (this.peek()?.type === 'comma') {
            this.consume('comma');
            args.push(this.parseExpression());
          }
        }
        this.consume('rparen');
        return { type: 'call', name: identName, args };
      }

      if (this.peek()?.type === 'dot') {
        const path: string[] = [identName];
        while (this.peek()?.type === 'dot') {
          this.consume('dot');
          const propToken = this.consume('ident');
          path.push(propToken.value);
        }
        return { type: 'property', path };
      }

      throw new Error(`Expressão inválida: identificador "${identName}" sem chamada ou acesso a propriedade`);
    }
    throw new Error(`Expressão inválida: token inesperado "${token.value}"`);
  }
}

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const evaluateNode = (node: Ast, context: WorkflowContext): unknown => {
  switch (node.type) {
    case 'number':
      return node.value;
    case 'string':
      return node.value;
    case 'call': {
      const fn = expressionFunctions.resolve(node.name);
      if (!fn) throw new Error(`Função de expressão desconhecida: "${node.name}"`);
      const args = node.args.map((arg) => evaluateNode(arg, context));
      return fn.call(args, context);
    }
    case 'property': {
      const [root, ...rest] = node.path;
      let value: unknown;

      if (root === 'event') {
        value = context.event.payload;
      } else if (root === 'input') {
        value = context.input ?? {};
      } else {
        throw new Error(`Expressão inválida: raiz "${root}" desconhecida (use "event" ou "input")`);
      }

      for (const key of rest) {
        if (value === null || value === undefined) {
          throw new Error(`Expressão inválida: propriedade "${key}" de valor nulo/indefinido`);
        }
        if (typeof value !== 'object') {
          throw new Error(`Expressão inválida: tentativa de acessar propriedade "${key}" em valor não-objeto`);
        }
        value = (value as Record<string, unknown>)[key];
      }

      return value;
    }
    case 'binop': {
      const left = evaluateNode(node.left, context);
      const right = evaluateNode(node.right, context);
      if (left instanceof Date && typeof right === 'number') {
        return addDays(left, node.op === '+' ? right : -right);
      }
      if (typeof left === 'number' && typeof right === 'number') {
        return node.op === '+' ? left + right : left - right;
      }
      throw new Error('Expressão inválida: operandos incompatíveis para "+"/"-"');
    }
    default:
      throw new Error('Expressão inválida');
  }
};

export interface ExpressionEngine {
  evaluate(expression: string, context: WorkflowContext): unknown;
}

class ExpressionEngineImpl implements ExpressionEngine {
  evaluate(expression: string, context: WorkflowContext): unknown {
    const tokens = tokenize(expression);
    const ast = new Parser(tokens).parseExpression();
    return evaluateNode(ast, context);
  }
}

export const expressionEngine: ExpressionEngine = new ExpressionEngineImpl();
