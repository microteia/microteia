import { describe, expect, it } from 'vitest';
import { evaluateFieldBoolean, evaluateFieldExpression, evaluateFieldValidation, extractFieldExpressionDependencies } from './fieldExpression';

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

describe('map', () => {
  const ctx = {
    value: null,
    data: {
      partes: [
        { pessoa: { nome: 'Ana' }, papel: 'autor' },
        { pessoa: { nome: 'Bruno' }, papel: 'reu' },
      ],
      vazios: [{ nome: 'Ana' }, { nome: '' }, { nome: null }, {}],
      naoArray: 'texto',
    },
  };

  it('extrai caminho simples e aninhado', () => {
    expect(evaluateFieldExpression('map(partes, "papel")', ctx)).toEqual(['autor', 'reu']);
    expect(evaluateFieldExpression('map(partes, "pessoa.nome")', ctx)).toEqual(['Ana', 'Bruno']);
  });

  it('caminho ausente vira undefined, sem quebrar', () => {
    expect(evaluateFieldExpression('map(partes, "pessoa.idade")', ctx)).toEqual([undefined, undefined]);
    expect(evaluateFieldExpression('map(partes, "a.b.c")', ctx)).toEqual([undefined, undefined]);
  });

  it('compact descarta vazios (mas preserva 0 e false)', () => {
    expect(evaluateFieldExpression('map(vazios, "nome")', ctx)).toEqual(['Ana', '', null, undefined]);
    expect(evaluateFieldExpression('map(vazios, "nome", true)', ctx)).toEqual(['Ana']);
    const zeros = { value: null, data: { itens: [{ n: 0 }, { n: false }, { n: null }] } };
    expect(evaluateFieldExpression('map(itens, "n", true)', zeros)).toEqual([0, false]);
  });

  it('caminho vazio devolve os próprios itens', () => {
    expect(evaluateFieldExpression('map(partes, "")', ctx)).toEqual(ctx.data.partes);
  });

  it('não-array devolve lista vazia', () => {
    expect(evaluateFieldExpression('map(naoArray, "x")', ctx)).toEqual([]);
    expect(evaluateFieldExpression('map(null, "x")', ctx)).toEqual([]);
    expect(evaluateFieldValidation('if(length(map(naoArray, "x")) > 0, "erro", null)', ctx)).toBe(null);
  });

  it('não expõe chaves internas do protótipo', () => {
    expect(evaluateFieldExpression('map(partes, "constructor.name")', ctx)).toEqual([undefined, undefined]);
    expect(evaluateFieldExpression('map(partes, "__proto__")', ctx)).toEqual([undefined, undefined]);
  });

  it('contains e indexOf aceitam array e texto (paridade com o catálogo do Workflow)', () => {
    expect(evaluateFieldExpression('contains(map(partes, "papel"), "autor")', ctx)).toBe(true);
    expect(evaluateFieldExpression('contains(map(partes, "papel"), "perito")', ctx)).toBe(false);
    expect(evaluateFieldExpression('indexOf(map(partes, "papel"), "reu")', ctx)).toBe(1);
    expect(evaluateFieldExpression('indexOf(map(partes, "papel"), "perito")', ctx)).toBe(-1);
    expect(evaluateFieldExpression('contains("abcdef", "cde")', ctx)).toBe(true);
    expect(evaluateFieldExpression('indexOf("abcdef", "cde")', ctx)).toBe(2);
  });

  it('combina com length e contains nas validações', () => {
    const expr = 'if(length(map(partes, "pessoa.nome", true)) < 2, "Informe ao menos 2 partes", null)';
    expect(evaluateFieldValidation(expr, ctx)).toBe(null);
  });
});

describe('extractFieldExpressionDependencies', () => {
  it('devolve as chaves de campo referenciadas', () => {
    expect(extractFieldExpressionDependencies("concat(nome, ' ', sobrenome)").sort())
      .toEqual(['nome', 'sobrenome']);
    expect(extractFieldExpressionDependencies('quantidade * precoUnitario').sort())
      .toEqual(['precoUnitario', 'quantidade']);
  });

  it('descarta os nomes reservados do escopo', () => {
    expect(extractFieldExpressionDependencies("if(isEmpty(value), status, self)").sort())
      .toEqual(['status']);
    expect(extractFieldExpressionDependencies('if(true, 1, null)')).toEqual([]);
  });

  it('devolve vazio para expressão ausente ou inválida', () => {
    expect(extractFieldExpressionDependencies(null)).toEqual([]);
    expect(extractFieldExpressionDependencies('')).toEqual([]);
    expect(extractFieldExpressionDependencies('concat(')).toEqual([]);
  });
});
