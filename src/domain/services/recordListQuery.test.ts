import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import {
  orderRecordsBy,
  planRecordListQuery,
  RECORD_LIST_FILTER_WINDOW,
  RECORD_LIST_PAGE_SIZE,
  recordConditionsQuery,
  recordMatchesQuery,
  recordQueryHasMore,
} from './recordListQuery';
import type { RecordListFilterInput } from './recordListQuery';

const field = (key: string, type: FieldDefinition['type'], extra: Partial<FieldDefinition> = {}): FieldDefinition => ({
  key, label: key, type, required: false, order: 0, origin: 'design', filterable: true, ...extra,
});

const FIELDS = [
  field('title', 'text'),
  field('status', 'select'),
  field('areas', 'select', { multi: true }),
  field('lawyer', 'reference', { refEntity: 'persons' }),
  field('activePole', 'reference', { refEntity: 'persons', multi: true }),
  field('urgent', 'checkbox'),
  field('filedAt', 'date'),
  field('dueAt', 'date'),
];

const plan = (over: Partial<RecordListFilterInput> = {}) => planRecordListQuery({
  collection: 'cases',
  fields: FIELDS,
  tokenMap: {},
  pageLimit: RECORD_LIST_PAGE_SIZE,
  parent: null,
  hasDeclaredOrder: false,
  paginate: true,
  ...over,
});

describe('a consulta da listagem', () => {
  it('sem filtro: os mais recentes, página a página', () => {
    expect(plan()).toEqual({
      collection: 'cases', limit: RECORD_LIST_PAGE_SIZE, anyOf: [], allOf: [], range: null, orderBy: { field: 'createdAt', dir: 'desc' },
    });
    expect(plan({ pageLimit: 150 })?.limit).toBe(150);
  });

  it('a busca livre não muda a consulta — ela tem caminho próprio no servidor', () => {
    expect(plan({ tokenMap: { search: ['curatela'] } })?.orderBy).toEqual({ field: 'createdAt', dir: 'desc' });
  });

  it('com filtro, UMA igualdade vai ao servidor, sem ordenar, na janela grande', () => {
    expect(plan({ tokenMap: { status: ['open', 'paused'], lawyer: ['p1'] } })).toEqual({
      collection: 'cases',
      limit: RECORD_LIST_FILTER_WINDOW,
      anyOf: [],
      allOf: [{ field: 'status', op: 'in', value: ['open', 'paused'] }],
      range: null,
      orderBy: null,
    });
    expect(plan({ tokenMap: { lawyer: ['p1'] } })?.allOf).toEqual([{ field: 'lawyer', op: '==', value: 'p1' }]);
  });

  it('campo múltiplo e etiqueta vão por array-contains-any; marcado, por igualdade com true', () => {
    expect(plan({ tokenMap: { activePole: ['p1', 'p2'] } })?.allOf).toEqual([{ field: 'activePole', op: 'array-contains-any', value: ['p1', 'p2'] }]);
    expect(plan({ tokenMap: { tag: ['t1'] } })?.allOf).toEqual([{ field: 'tagIds', op: 'array-contains-any', value: ['t1'] }]);
    expect(plan({ tokenMap: { urgent: ['true'] } })?.allOf).toEqual([{ field: 'urgent', op: '==', value: true }]);
  });

  it('desmarcado não vai ao servidor — o campo ausente também é desmarcado, e a igualdade não o acharia', () => {
    expect(plan({ tokenMap: { urgent: ['false'] } })).toEqual({
      collection: 'cases', limit: RECORD_LIST_FILTER_WINDOW, anyOf: [], allOf: [], range: null, orderBy: { field: 'createdAt', dir: 'desc' },
    });
  });

  it('mais de 30 valores passa do teto do in: fica em memória sobre a janela', () => {
    const many = Array.from({ length: 31 }, (_, index) => `s${index}`);
    expect(plan({ tokenMap: { status: many } })?.allOf).toEqual([]);
  });

  it('filtro só de data pagina pelo próprio campo; data com outro filtro, a igualdade vai e a data fica em memória', () => {
    expect(plan({ tokenMap: { filedAt: ['2026-01-01'], 'filedAt:ate': ['2026-03-31'] } })).toEqual({
      collection: 'cases',
      limit: RECORD_LIST_PAGE_SIZE,
      anyOf: [],
      allOf: [],
      range: { field: 'filedAt', from: '2026-01-01', to: '2026-03-31' },
      orderBy: { field: 'filedAt', dir: 'desc' },
    });
    expect(plan({ tokenMap: { 'filedAt:ate': ['2026-03-31'] } })?.range).toEqual({ field: 'filedAt', from: null, to: '2026-03-31' });
    expect(plan({ tokenMap: { filedAt: ['2026-01-01'], status: ['open'] } })?.allOf).toEqual([{ field: 'status', op: '==', value: 'open' }]);
  });

  it('duas datas ao mesmo tempo não cabem num índice simples: a janela grande, em memória', () => {
    expect(plan({ tokenMap: { filedAt: ['2026-01-01'], dueAt: ['2026-02-01'] } })?.range).toBeNull();
  });

  it('a aba do pai consulta só os filhos dele, por qualquer dos campos', () => {
    expect(plan({ parent: { fieldKeys: ['lawyer', 'activePole'], recordId: 'p1' } })).toEqual({
      collection: 'cases',
      limit: RECORD_LIST_FILTER_WINDOW,
      anyOf: [
        { field: 'lawyer', op: '==', value: 'p1' },
        { field: 'activePole', op: 'array-contains', value: 'p1' },
      ],
      allOf: [],
      range: null,
      orderBy: null,
    });
  });

  it('sem paginar, a lista fica na janela da coleção — salvo a aba do pai, que continua sendo só dos filhos', () => {
    expect(plan({ paginate: false, tokenMap: { status: ['open'] } })).toBeNull();
    expect(plan({ paginate: false, parent: { fieldKeys: ['lawyer'], recordId: 'p1' } })?.anyOf).toEqual([{ field: 'lawyer', op: '==', value: 'p1' }]);
  });

  it('a tela com ordem própria fica na janela: paginar por cadastro mostraria a página errada da agenda', () => {
    expect(plan({ hasDeclaredOrder: true })).toBeNull();
  });

  it('na aba do pai, o filtro escolhido vai junto com o vínculo, e a janela cresce com a rolagem', () => {
    const spec = plan({ parent: { fieldKeys: ['lawyer'], recordId: 'p1' }, tokenMap: { status: ['open'] }, pageLimit: 600 });
    expect(spec?.anyOf).toEqual([{ field: 'lawyer', op: '==', value: 'p1' }]);
    expect(spec?.allOf).toEqual([{ field: 'status', op: '==', value: 'open' }]);
    expect(spec?.limit).toBe(600);
  });

  it('na aba do pai, o que o Firestore recusa combinar fica em memória', () => {
    // array-contains (o pai é campo múltiplo) com array-contains-any (o filtro também): recusado.
    expect(plan({ parent: { fieldKeys: ['activePole'], recordId: 'p1' }, tokenMap: { areas: ['a1'] } })?.allOf).toEqual([]);
    // Dois campos de pai vezes 16 valores passa das 30 disjunções.
    const many = Array.from({ length: 16 }, (_, index) => `s${index}`);
    expect(plan({ parent: { fieldKeys: ['lawyer', 'activePole'], recordId: 'p1' }, tokenMap: { status: many } })?.allOf).toEqual([]);
  });

  it('há mais quando veio tudo o que se pediu', () => {
    const spec = plan();
    expect(spec && recordQueryHasMore(spec, RECORD_LIST_PAGE_SIZE)).toBe(true);
    expect(spec && recordQueryHasMore(spec, 12)).toBe(false);
  });
});

describe('as condições da extensão', () => {
  it('igualdade por padrão, e o intervalo de dia separado', () => {
    expect(recordConditionsQuery([
      { field: 'status', value: 'Pendente' },
      { field: 'tags', op: 'array-contains', value: 't1' },
      { field: 'dueDate', to: '2026-11-04' },
    ])).toEqual({
      allOf: [{ field: 'status', op: '==', value: 'Pendente' }, { field: 'tags', op: 'array-contains', value: 't1' }],
      range: { field: 'dueDate', from: null, to: '2026-11-04' },
    });
  });

  it('recusa o que não cabe numa consulta: dois intervalos, intervalo sem ponta, dia fora de AAAA-MM-DD', () => {
    expect(recordConditionsQuery([{ field: 'a', from: '2026-01-01' }, { field: 'b', to: '2026-01-01' }])).toBeNull();
    expect(recordConditionsQuery([{ field: 'a', from: null, to: '' }])).toBeNull();
    expect(recordConditionsQuery([{ field: 'a', to: '04/11/2026' }])).toBeNull();
  });
});

describe('a mesma consulta em memória', () => {
  const noon = (day: string) => new Date(`${day}T12:00:00.000Z`);
  const spec = (over: Partial<Parameters<typeof recordMatchesQuery>[1]> = {}) => ({ anyOf: [], allOf: [], range: null, ...over });

  it('as quatro igualdades do servidor', () => {
    expect(recordMatchesQuery({ s: 'a' }, spec({ allOf: [{ field: 's', op: '==', value: 'a' }] }))).toBe(true);
    expect(recordMatchesQuery({ s: 'b' }, spec({ allOf: [{ field: 's', op: 'in', value: ['a', 'b'] }] }))).toBe(true);
    expect(recordMatchesQuery({ s: ['x', 'y'] }, spec({ allOf: [{ field: 's', op: 'array-contains', value: 'y' }] }))).toBe(true);
    expect(recordMatchesQuery({ s: ['x'] }, spec({ allOf: [{ field: 's', op: 'array-contains-any', value: ['z'] }] }))).toBe(false);
    expect(recordMatchesQuery({ p: 'p2' }, spec({ anyOf: [{ field: 'p', op: '==', value: 'p1' }, { field: 'p', op: '==', value: 'p2' }] }))).toBe(true);
  });

  it('o dia do intervalo é inclusivo nas duas pontas, e a data ausente fica de fora', () => {
    const range = { field: 'dueDate', from: '2026-11-05', to: '2026-11-12' };
    expect(recordMatchesQuery({ dueDate: noon('2026-11-05') }, spec({ range }))).toBe(true);
    expect(recordMatchesQuery({ dueDate: noon('2026-11-12') }, spec({ range }))).toBe(true);
    expect(recordMatchesQuery({ dueDate: noon('2026-11-13') }, spec({ range }))).toBe(false);
    expect(recordMatchesQuery({}, spec({ range }))).toBe(false);
  });

  it('a ordem do servidor, com o valor ausente no fim', () => {
    const records = [{ id: 'b', at: noon('2026-02-01') }, { id: 'x' }, { id: 'a', at: noon('2026-01-01') }];
    expect(orderRecordsBy(records, { field: 'at', dir: 'asc' }).map((record) => record.id)).toEqual(['a', 'b', 'x']);
    expect(orderRecordsBy(records, { field: 'at', dir: 'desc' }).map((record) => record.id)).toEqual(['b', 'a', 'x']);
  });
});
