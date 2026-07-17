import { describe, expect, it } from 'vitest';
import { evaluateFieldBoolean, evaluateFieldExpression, evaluateFieldValidation } from './fieldExpression';

describe('evaluateFieldExpression — escopo e literais', () => {
  it('acessa campos por chave e o valor do próprio campo', () => {
    const ctx = { value: 'abc', data: { status: 'ativo', total: 10 } };
    expect(evaluateFieldExpression('status', ctx)).toBe('ativo');
    expect(evaluateFieldExpression('total + 5', ctx)).toBe(15);
    expect(evaluateFieldExpression('value', ctx)).toBe('abc');
    expect(evaluateFieldExpression('self', ctx)).toBe('abc');
  });

  it('resolve os literais null, true e false (expr-eval não os tem nativamente)', () => {
    const ctx = { value: null, data: {} };
    expect(evaluateFieldExpression('null', ctx)).toBe(null);
    expect(evaluateFieldExpression('true', ctx)).toBe(true);
    expect(evaluateFieldExpression('if(true, "sim", null)', ctx)).toBe('sim');
    expect(evaluateFieldExpression('if(false, "sim", null)', ctx)).toBe(null);
  });

  it('operadores lógicos and/or e comparação', () => {
    const ctx = { value: '', data: { a: 1, b: 2 } };
    expect(evaluateFieldExpression('a == 1 and b == 2', ctx)).toBe(true);
    expect(evaluateFieldExpression('a == 9 or b == 2', ctx)).toBe(true);
  });
});

describe('evaluateFieldBoolean', () => {
  it('vazio ou ausente → false', () => {
    expect(evaluateFieldBoolean('', { value: null, data: {} })).toBe(false);
    expect(evaluateFieldBoolean(null, { value: null, data: {} })).toBe(false);
    expect(evaluateFieldBoolean(undefined, { value: null, data: {} })).toBe(false);
  });

  it('avalia a condição sobre os campos', () => {
    const ctx = { value: null, data: { eletrico: true } };
    expect(evaluateFieldBoolean('eletrico == true', ctx)).toBe(true);
    expect(evaluateFieldBoolean('eletrico == false', ctx)).toBe(false);
  });

  it('expressão que referencia campo ausente não quebra → false', () => {
    expect(evaluateFieldBoolean('naoExiste == 1', { value: null, data: {} })).toBe(false);
  });
});

describe('evaluateFieldValidation', () => {
  it('string não-vazia é a mensagem de erro; null/vazio/false é ok', () => {
    const ctx = { value: '', data: {} };
    expect(evaluateFieldValidation('"Erro fixo"', ctx)).toBe('Erro fixo');
    expect(evaluateFieldValidation('null', ctx)).toBe(null);
    expect(evaluateFieldValidation('""', ctx)).toBe(null);
    expect(evaluateFieldValidation('false', ctx)).toBe(null);
  });

  it('padrão obrigatório-condicional', () => {
    const expr = 'if(isEmpty(value) and status == "ativo", "Obrigatório para ativos", null)';
    expect(evaluateFieldValidation(expr, { value: '', data: { status: 'ativo' } })).toBe('Obrigatório para ativos');
    expect(evaluateFieldValidation(expr, { value: 'x', data: { status: 'ativo' } })).toBe(null);
    expect(evaluateFieldValidation(expr, { value: '', data: { status: 'inativo' } })).toBe(null);
  });

  it('funções puras do catálogo', () => {
    expect(evaluateFieldValidation('if(isCPF(value), null, "CPF inválido")', { value: '52998224725', data: {} })).toBe(null);
    expect(evaluateFieldValidation('if(isCPF(value), null, "CPF inválido")', { value: '11111111111', data: {} })).toBe('CPF inválido');
    expect(evaluateFieldExpression('onlyNumber("a1b2")', { value: '', data: {} })).toBe('12');
    expect(evaluateFieldExpression('upper("ab")', { value: '', data: {} })).toBe('AB');
  });

  it('expressão inválida não bloqueia (retorna null)', () => {
    expect(evaluateFieldValidation('funcaoInexistente(1)', { value: '', data: {} })).toBe(null);
  });
});
