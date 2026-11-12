import { describe, it, expect } from 'vitest';
import { aiExtractFields, aiStepList } from './aiSteps';

describe('helpers dos passos de IA', () => {
  it('a lista aceita vírgula numa linha só, ou uma por linha — e aí a vírgula fica no item', () => {
    expect(aiStepList('a, b,, a')).toEqual(['a', 'b']);
    expect(aiStepList('total: o valor, com centavos\nnumero')).toEqual(['total: o valor, com centavos', 'numero']);
    expect(aiStepList(['x', ' y '])).toEqual(['x', 'y']);
    expect(aiStepList(undefined)).toEqual([]);
  });

  it('o campo é "chave: descrição [lista]", e a chave inválida para expressão sai', () => {
    expect(aiExtractFields('total: o valor\nnúmero da nota\nassunto: do que trata [financeiro | suporte|]\nurgencia: [alta|baixa]')).toEqual([
      { key: 'total', description: 'o valor' },
      { key: 'assunto', description: 'do que trata', options: ['financeiro', 'suporte'] },
      { key: 'urgencia', description: '', options: ['alta', 'baixa'] },
    ]);
  });
});
