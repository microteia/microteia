import { describe, it, expect } from 'vitest';
import { evaluateFieldBoolean, evaluateFieldExpression } from './fieldExpression';

const ctx = { value: null, data: { ativo: true, contador: 3 } };

/**
 * O `!` do `expr-eval` é o fatorial. Enquanto foi assim, `!hasPermission("x")` valia `1` — a
 * expressão passava no validador, parecia dizer "quando NÃO puder" e dizia "sempre".
 */
describe('negação com `!`', () => {
  it('nega um booleano', () => {
    expect(evaluateFieldExpression('!ativo', ctx)).toBe(false);
    expect(evaluateFieldExpression('!false', ctx)).toBe(true);
  });

  it('não é mais o fatorial', () => {
    expect(evaluateFieldExpression('!contador', ctx)).toBe(false);
  });

  it('nega a chamada de uma função', () => {
    expect(evaluateFieldBoolean('!isEmpty(ativo)', ctx)).toBe(true);
  });

  it('`not` continua valendo, e diz o mesmo', () => {
    expect(evaluateFieldExpression('not ativo', ctx)).toBe(false);
  });

  it('compõe com o resto da expressão', () => {
    expect(evaluateFieldBoolean('!ativo or contador > 2', ctx)).toBe(true);
    expect(evaluateFieldBoolean('!ativo and contador > 2', ctx)).toBe(false);
  });
});
