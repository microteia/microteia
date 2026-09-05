import { describe, it, expect } from 'vitest';
import { evaluateResolvedPredicate, looseEquals } from './predicateMatch';
import type { ResolvedPredicate } from './predicateMatch';

const matches = (record: Record<string, unknown>, predicate: ResolvedPredicate): boolean =>
  evaluateResolvedPredicate(record, predicate);

/**
 * A linha chega HIDRATADA: onde o documento guarda o id de uma referência, ela traz o registro
 * apontado inteiro — e a de vários, a lista deles. Enquanto a comparação era entre o objeto e o id
 * que o filtro trouxe, NENHUM filtro sobre referência achava nada: nem o de um, nem o de vários, e
 * o relatório voltava vazio, que se lê como "não há nada assim".
 */
describe('evaluateResolvedPredicate — referência hidratada', () => {
  const caso = {
    id: '1',
    owner: { id: 'p1', nome: 'Ana' },
    poloAtivo: [{ id: 'p1', nome: 'Ana' }, { id: 'p2', nome: 'Bruno' }],
  };

  it('a referência de UM é comparada pelo id do apontado', () => {
    expect(matches(caso, { path: 'owner', op: 'eq', value: 'p1' })).toBe(true);
    expect(matches(caso, { path: 'owner', op: 'eq', value: 'p9' })).toBe(false);
  });

  it('a de VÁRIOS atende quando o escolhido está entre os apontados', () => {
    expect(matches(caso, { path: 'poloAtivo', op: 'eq', value: 'p2' })).toBe(true);
    expect(matches(caso, { path: 'poloAtivo', op: 'contains', value: 'p2' })).toBe(true);
    expect(matches(caso, { path: 'poloAtivo', op: 'eq', value: 'p9' })).toBe(false);
  });

  it('vários ESCOLHIDOS perguntam por qualquer um deles', () => {
    expect(matches(caso, { path: 'poloAtivo', op: 'eq', value: ['p9', 'p2'] })).toBe(true);
    expect(matches(caso, { path: 'poloAtivo', op: 'eq', value: ['p8', 'p9'] })).toBe(false);
    expect(matches(caso, { path: 'owner', op: 'eq', value: ['p1', 'p9'] })).toBe(true);
  });

  it('o "diferente de" é a negação da mesma pergunta', () => {
    expect(matches(caso, { path: 'poloAtivo', op: 'neq', value: 'p1' })).toBe(false);
    expect(matches(caso, { path: 'poloAtivo', op: 'neq', value: 'p9' })).toBe(true);
  });

  it('`in` vale para os dois lados listas', () => {
    expect(matches(caso, { path: 'poloAtivo', op: 'in', value: ['p2', 'p3'] })).toBe(true);
    expect(matches(caso, { path: 'owner', op: 'in', value: ['p1'] })).toBe(true);
  });
});

/** O campo de vários que NÃO é referência — a lista de opções — segue a mesma regra. */
describe('evaluateResolvedPredicate — campo de vários', () => {
  const registro = { id: '1', etiquetas: ['urgente', 'civel'] };

  it('igualdade contra uma lista é pertinência', () => {
    expect(matches(registro, { path: 'etiquetas', op: 'eq', value: 'civel' })).toBe(true);
    expect(matches(registro, { path: 'etiquetas', op: 'eq', value: 'penal' })).toBe(false);
  });
});

describe('looseEquals', () => {
  it('o registro apontado é o id dele', () => {
    expect(looseEquals({ id: 'p1', nome: 'Ana' }, 'p1')).toBe(true);
    expect(looseEquals('p1', { id: 'p1' })).toBe(true);
    expect(looseEquals({ id: 'p1' }, { id: 'p2' })).toBe(false);
  });

  it('e as tolerâncias que já existiam continuam', () => {
    expect(looseEquals(new Date('2026-01-10T00:00:00.000Z'), '2026-01-10T00:00:00.000Z')).toBe(true);
    expect(looseEquals(10, '10')).toBe(true);
  });
});
