import { describe, it, expect } from 'vitest';
import { aiExtractFields, aiStepList, matchAiCategory } from './aiSteps';

describe('helpers dos passos de IA', () => {
  it('a lista aceita vírgula numa linha só, ou uma por linha — e aí a vírgula fica no item', () => {
    expect(aiStepList('a, b,, a')).toEqual(['a', 'b']);
    expect(aiStepList('total: o valor, com centavos\nnumero')).toEqual(['total: o valor, com centavos', 'numero']);
    expect(aiStepList(['x', ' y '])).toEqual(['x', 'y']);
    expect(aiStepList(undefined)).toEqual([]);
  });

  it('a categoria só vale se está na lista, e sai na grafia dela', () => {
    expect(matchAiCategory(' Suporte', ['financeiro', 'suporte'])).toBe('suporte');
    expect(matchAiCategory('outra', ['financeiro', 'suporte'])).toBeNull();
    expect(matchAiCategory(null, ['a'])).toBeNull();
  });

  it('o campo é "chave: descrição", e a chave inválida para expressão sai', () => {
    expect(aiExtractFields('total: o valor\nnúmero da nota\nnumero')).toEqual([
      { key: 'total', description: 'o valor' },
      { key: 'numero', description: '' },
    ]);
  });
});
