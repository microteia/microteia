import { describe, expect, it } from 'vitest';
import type { WorkflowContext } from '../../../entities/WorkflowContext';
import { expressionEngine } from '../ExpressionEngine';

const context = {
  event: { payload: { dueDate: new Date('2026-10-16T12:00:00Z'), invalid: new Date('x'), blank: {}, filled: { a: 1 } } },
  input: {},
  outputs: {},
  variables: {},
} as unknown as WorkflowContext;

const evaluate = (expression: string) => expressionEngine.evaluate(expression, context);

describe('isEmptyFn', () => {
  it('data válida do evento não é vazia', () => {
    expect(evaluate('isEmpty(event.dueDate)')).toBe(false);
    expect(evaluate('not isEmpty(event.dueDate)')).toBe(true);
  });

  it('data inválida conta como vazia', () => {
    expect(evaluate('isEmpty(event.invalid)')).toBe(true);
  });

  it('objeto simples continua vazio só sem campos', () => {
    expect(evaluate('isEmpty(event.blank)')).toBe(true);
    expect(evaluate('isEmpty(event.filled)')).toBe(false);
  });

  it('nulo, ausente, string em branco e lista vazia seguem vazios', () => {
    expect(evaluate('isEmpty(event.missing)')).toBe(true);
    expect(evaluate('isEmpty("  ")')).toBe(true);
    expect(evaluate('isEmpty(event.filled.a)')).toBe(false);
  });
});
