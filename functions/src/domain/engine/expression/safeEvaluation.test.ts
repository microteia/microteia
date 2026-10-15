import { describe, expect, it } from 'vitest';
import { expressionEngine } from './ExpressionEngine';
import type { WorkflowContext } from '../../entities/WorkflowContext';

const silent = { info: () => undefined, warn: () => undefined, error: () => undefined };

const contextWith = (outputs: WorkflowContext['outputs'], variables: Record<string, unknown> = {}): WorkflowContext => ({
  event: { id: 'e1', tenantId: 't1', name: 'workflow.called', payload: {}, timestamp: new Date() },
  outputs,
  variables,
  services: { logger: silent, now: () => new Date() },
  logger: silent,
  execution: { id: 'x1', workflowDefinitionId: 'w1', tenantId: 't1' },
});

const emptyQuery = contextWith({ q: { count: 0, items: [], first: null } });
const fullQuery = contextWith({ q: { count: 1, items: [{ x: 'a' }], first: { x: 'a' } } });

describe('avaliação segura no motor de expressões do fluxo', () => {
  it('a condição sobre uma consulta vazia responde, em vez de derrubar o passo', () => {
    expect(expressionEngine.evaluate('output.q.count < 1 or isEmpty(output.q.first.x)', emptyQuery)).toBe(true);
    expect(expressionEngine.evaluate('output.q.count < 1 or isEmpty(output.q.first.x)', fullQuery)).toBe(false);
    expect(expressionEngine.evaluate('output.q.count >= 1 and output.q.first.x == "a"', emptyQuery)).toBe(false);
  });

  it('membro de null é null, em qualquer profundidade', () => {
    expect(expressionEngine.evaluate('output.q.first.x', emptyQuery)).toBeNull();
    expect(expressionEngine.evaluate('output.q.first.x.y', emptyQuery)).toBeNull();
    expect(expressionEngine.evaluate('isEmpty(output.q.first.x)', emptyQuery)).toBe(true);
    expect(expressionEngine.evaluate('coalesce(output.q.first.x, "padrão")', emptyQuery)).toBe('padrão');
    expect(expressionEngine.evaluate('output.q.first.x', fullQuery)).toBe('a');
  });

  it('caminho que não existe continua sendo erro, e não vazio — é o que acusa `event.payload.x`', () => {
    expect(expressionEngine.evaluate('output.ausente', emptyQuery)).toBeUndefined();
    expect(() => expressionEngine.evaluate('output.ausente.x', emptyQuery)).toThrow();
  });

  it('`a ? b.c : d` com b nulo responde nos dois ramos', () => {
    expect(expressionEngine.evaluate('a ? b.c : d', contextWith({}, { a: false, b: null, d: 5 }))).toBe(5);
    expect(expressionEngine.evaluate('a ? b.c : d', contextWith({}, { a: true, b: null, d: 5 }))).toBeNull();
  });

  it('`if` avalia só o ramo escolhido, como `?:`', () => {
    const context = contextWith({}, { n: 0 });
    expect(expressionEngine.evaluate('if(n == 0, "zero", missing)', context)).toBe('zero');
    expect(expressionEngine.evaluate('if(n != 0, missing, "zero")', context)).toBe('zero');
    expect(() => expressionEngine.evaluate('if(n == 0, missing, "zero")', context)).toThrow();
  });

  it('`if` aninhado, dentro de função e com argumentos compostos continua certo', () => {
    const context = contextWith({ q: { count: 2 } }, { n: 3 });
    expect(expressionEngine.evaluate('if(n > 2, if(n > 5, "grande", "médio"), "pequeno")', context)).toBe('médio');
    expect(expressionEngine.evaluate('upper(if(output.q.count > 1, "a" || "b", "c"))', context)).toBe('AB');
    expect(expressionEngine.evaluate('max(if(n > 2, n * 2, 1), 1) + 1', context)).toBe(7);
    expect(expressionEngine.evaluate('if(isEmpty([]), [1, 2], [3])', context)).toEqual([1, 2]);
  });
});
