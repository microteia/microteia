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

describe('evaluateResolvedPredicate — o campo de cada apontado', () => {
  /** Como a linha chega hidratada: o registro apontado inteiro, e uma referência de vários, todos. */
  const registro = { id: '1', poles: [{ id: 'p1', cidade: 'Recife' }, { id: 'p2', cidade: 'Olinda' }] };

  it('filtra pelo campo de qualquer um dos apontados', () => {
    expect(matches(registro, { path: 'poles.cidade', op: 'eq', value: 'Olinda' })).toBe(true);
    expect(matches(registro, { path: 'poles.cidade', op: 'eq', value: 'Natal' })).toBe(false);
    expect(matches(registro, { path: 'poles.cidade', op: 'in', value: ['Natal', 'Recife'] })).toBe(true);
  });

  it('nenhum apontado com o campo é ausência de valor, e não um valor vazio', () => {
    expect(matches({ id: '1', poles: [] }, { path: 'poles.cidade', op: 'exists' })).toBe(false);
    expect(matches({ id: '1', poles: [{ id: 'p1' }] }, { path: 'poles.cidade', op: 'exists' })).toBe(false);
    expect(matches(registro, { path: 'poles.cidade', op: 'exists' })).toBe(true);
  });
});

describe('evaluateResolvedPredicate — contém', () => {
  const registro = {
    id: '1',
    titulo: 'Ação de Indenizacao',
    emails: ['alexnaldo.santos@gmail.com', 'carol@gmail.com'],
    etiquetas: ['urgente', 'civel'],
    poles: [{ id: 'p1', nome: 'Ana' }, { id: 'p2', nome: 'Bruno' }],
  };

  it('numa lista de TEXTO é subcadeia em qualquer item', () => {
    // O caso que voltava vazio: um caminho que atravessa a referência de vários colhe o e-mail de
    // cada apontado, e ninguém digita o e-mail inteiro para filtrar.
    expect(matches(registro, { path: 'emails', op: 'contains', value: 'alex' })).toBe(true);
    expect(matches(registro, { path: 'emails', op: 'contains', value: 'carol' })).toBe(true);
    expect(matches(registro, { path: 'emails', op: 'contains', value: 'joana' })).toBe(false);
  });

  it('não diferencia maiúscula de minúscula, como o "contém" da condição de automação', () => {
    expect(matches(registro, { path: 'emails', op: 'contains', value: 'ALEX' })).toBe(true);
    expect(matches(registro, { path: 'titulo', op: 'contains', value: 'indenizacao' })).toBe(true);
  });

  it('numa lista de OPÇÕES segue achando a opção escolhida', () => {
    expect(matches(registro, { path: 'etiquetas', op: 'contains', value: 'urgente' })).toBe(true);
    expect(matches(registro, { path: 'etiquetas', op: 'contains', value: 'penal' })).toBe(false);
  });

  it('numa lista de REFERÊNCIAS é pertinência pelo id, nunca subcadeia', () => {
    expect(matches(registro, { path: 'poles', op: 'contains', value: 'p2' })).toBe(true);
    expect(matches(registro, { path: 'poles', op: 'contains', value: 'p' })).toBe(false);
  });

  it('com vários escolhidos, basta que UM deles esteja contido', () => {
    expect(matches(registro, { path: 'emails', op: 'contains', value: ['joana', 'carol'] })).toBe(true);
    expect(matches(registro, { path: 'emails', op: 'contains', value: ['joana', 'maria'] })).toBe(false);
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

/**
 * O defeito relatado por um agente: `gte` em `createdAt` com um valor ISO voltava ZERO registros,
 * havendo registros que atendiam. A linha chega com `Date` e o filtro com texto, e o texto ia para
 * `Number()` — `NaN`, comparação declarada impossível, linha descartada.
 */
describe('evaluateResolvedPredicate — datas comparam como datas', () => {
  const registro = { id: '1', createdAt: new Date('2026-10-01T15:30:00Z') };
  const casa = (op: ResolvedPredicate['op'], value: unknown): boolean =>
    matches(registro, { path: 'createdAt', op, value });

  it('o instante ISO completo compara como instante', () => {
    expect(casa('gte', '2026-10-01T00:00:00Z')).toBe(true);
    expect(casa('gte', '2026-10-01T15:30:00.001Z')).toBe(false);
    expect(casa('lt', '2026-10-01T12:30:00-03:00')).toBe(false);
    expect(casa('lte', '2026-10-01T12:30:00-03:00')).toBe(true);
  });

  it('o dia puro é o dia INTEIRO, e cada operador pergunta o que se lê nele', () => {
    expect(casa('gte', '2026-10-01')).toBe(true);
    expect(casa('lte', '2026-10-01')).toBe(true);
    expect(casa('eq', '2026-10-01')).toBe(true);
    expect(casa('gt', '2026-10-01')).toBe(false);
    expect(casa('lt', '2026-10-01')).toBe(false);
    expect(casa('neq', '2026-10-01')).toBe(false);
    expect(casa('gt', '2026-09-30')).toBe(true);
    expect(casa('lt', '2026-10-02')).toBe(true);
  });

  it('o campo de data gravado na âncora de meio-dia cai no próprio dia', () => {
    const prazo = { id: '1', dueOn: new Date(Date.UTC(2026, 9, 1, 12)) };
    expect(matches(prazo, { path: 'dueOn', op: 'eq', value: '2026-10-01' })).toBe(true);
    expect(matches(prazo, { path: 'dueOn', op: 'lte', value: '2026-09-30' })).toBe(false);
  });

  it('o objeto Date no filtro também compara', () => {
    expect(casa('gte', new Date('2026-09-01T00:00:00Z'))).toBe(true);
  });

  it('texto que não é data não vira data só porque o filtro trouxe um dia', () => {
    expect(matches({ id: '1', code: '1' }, { path: 'code', op: 'gte', value: '2026-10-01' })).toBe(false);
    expect(matches({ id: '1', code: 'b' }, { path: 'code', op: 'gt', value: 'a' })).toBe(true);
  });
});
