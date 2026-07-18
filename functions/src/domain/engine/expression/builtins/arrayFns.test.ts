import { describe, expect, it } from 'vitest';
import type { WorkflowContext } from '../../../entities/WorkflowContext';
import { expressionEngine } from '../ExpressionEngine';

const buildContext = (payload: Record<string, unknown>): WorkflowContext =>
  ({
    event: { payload },
    input: {},
    outputs: {},
    variables: {},
  }) as unknown as WorkflowContext;

const context = buildContext({
  partes: [
    { pessoa: { nome: 'Ana' }, papel: 'autor' },
    { pessoa: { nome: 'Bruno' }, papel: 'reu' },
  ],
  vazios: [{ nome: 'Ana' }, { nome: '' }, { nome: null }, {}],
});

const evaluate = (expression: string) => expressionEngine.evaluate(expression, context);

describe('mapFn', () => {
  it('extrai caminho simples e aninhado', () => {
    expect(evaluate('map(event.partes, "papel")')).toEqual(['autor', 'reu']);
    expect(evaluate('map(event.partes, "pessoa.nome")')).toEqual(['Ana', 'Bruno']);
  });

  it('caminho ausente vira undefined, sem quebrar', () => {
    expect(evaluate('map(event.partes, "pessoa.idade")')).toEqual([undefined, undefined]);
  });

  it('compact descarta vazios', () => {
    expect(evaluate('map(event.vazios, "nome")')).toEqual(['Ana', '', null, undefined]);
    expect(evaluate('map(event.vazios, "nome", true)')).toEqual(['Ana']);
  });

  it('caminho vazio devolve os próprios itens', () => {
    expect(evaluate('map(event.partes, "")')).toEqual([
      { pessoa: { nome: 'Ana' }, papel: 'autor' },
      { pessoa: { nome: 'Bruno' }, papel: 'reu' },
    ]);
  });

  it('não expõe chaves internas do protótipo', () => {
    expect(evaluate('map(event.partes, "constructor.name")')).toEqual([undefined, undefined]);
    expect(evaluate('map(event.partes, "__proto__")')).toEqual([undefined, undefined]);
  });

  it('não-array é erro', () => {
    expect(() => evaluate('map("texto", "x")')).toThrow(/array/);
  });
});

describe('containsFn e indexOfFn — array e texto', () => {
  it('opera sobre arrays', () => {
    expect(evaluate('contains(map(event.partes, "papel"), "autor")')).toBe(true);
    expect(evaluate('contains(map(event.partes, "papel"), "perito")')).toBe(false);
    expect(evaluate('indexOf(map(event.partes, "papel"), "reu")')).toBe(1);
    expect(evaluate('indexOf(map(event.partes, "papel"), "perito")')).toBe(-1);
  });

  it('opera sobre texto', () => {
    expect(evaluate('contains("abcdef", "cde")')).toBe(true);
    expect(evaluate('contains("abcdef", "xyz")')).toBe(false);
    expect(evaluate('indexOf("abcdef", "cde")')).toBe(2);
  });

  it('rejeita alvo que não é array nem texto', () => {
    expect(() => evaluate('contains(1, 2)')).toThrow(/array ou texto/);
    expect(() => evaluate('indexOf(1, 2)')).toThrow(/array ou texto/);
  });
});
