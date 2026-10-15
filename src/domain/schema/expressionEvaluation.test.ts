import { describe, expect, it } from 'vitest';
import { evaluateFieldBoolean, evaluateFieldExpression } from './fieldExpression';

describe('avaliação segura nas expressões de tela', () => {
  it('membro de referência vazia é null, e a negação dele é verdadeira', () => {
    expect(evaluateFieldExpression('client.city', { value: null, data: { client: null } })).toBeNull();
    expect(evaluateFieldExpression('isEmpty(client.address.city)', { value: null, data: { client: { address: null } } })).toBe(true);
    expect(() => evaluateFieldExpression('client.address.city', { value: null, data: { client: {} } })).toThrow();
    expect(evaluateFieldBoolean('!client.active', { value: null, data: { client: null } }, false)).toBe(true);
  });

  it('`if` avalia só o ramo escolhido', () => {
    expect(evaluateFieldExpression('if(isEmpty(client), "sem cliente", client.name.first)', { value: null, data: { client: null } }))
      .toBe('sem cliente');
    expect(evaluateFieldExpression('if(total > 0, total, missing)', { value: null, data: { total: 3 } })).toBe(3);
  });
});
