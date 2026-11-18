import { describe, expect, it } from 'vitest';
import {
  LIST_ORDER_MAX_KEYS,
  guestListOrder,
  listOrderComparator,
  listOrderIssues,
  readListOrder,
} from './listOrder';

const FIELDS = [
  { key: 'vencimento', type: 'date' },
  { key: 'parcela', type: 'number' },
  { key: 'descricao', type: 'text' },
  { key: 'situacao', type: 'select' },
  { key: 'cliente', type: 'reference' },
  { key: 'pago', type: 'checkbox' },
  { key: 'etiquetas', type: 'text', multi: true },
];

interface Row {
  id: string;
  createdAt?: Date;
  vencimento?: Date | null;
  parcela?: number;
  descricao?: string;
}

const day = (iso: string): Date => new Date(`${iso}T12:00:00Z`);
const ids = (rows: Row[]): string[] => rows.map((row) => row.id);

describe('listOrderIssues — o portão da autoria', () => {
  it('sem declaração não há o que recusar', () => {
    expect(listOrderIssues(undefined, FIELDS)).toEqual([]);
    expect(listOrderIssues(null, FIELDS)).toEqual([]);
  });

  it('aceita campo de valor único que ordena pelo que se vê, e os carimbos do registro', () => {
    expect(listOrderIssues([
      { path: 'vencimento', dir: 'asc' },
      { path: 'parcela', dir: 'desc' },
      { path: 'createdAt', dir: 'desc' },
    ], FIELDS)).toEqual([]);
  });

  it('recusa o que não é lista, a chave sem forma e a direção desconhecida, apontando o caminho', () => {
    expect(listOrderIssues({ path: 'vencimento' }, FIELDS)[0].message).toBe('@core.records/list-order.issue.not-list');
    const issues = listOrderIssues([{ dir: 'asc' }, { path: 'vencimento', dir: 'up' }], FIELDS, 'screens[0].listOrder');
    expect(issues.map((one) => [one.message, one.messageParams.where])).toEqual([
      ['@core.records/list-order.issue.key-shape', 'screens[0].listOrder[0]'],
      ['@core.records/list-order.issue.direction', 'screens[0].listOrder[1].dir'],
    ]);
  });

  it('recusa campo que a tela não tem, e o que ordenaria por chave, id, booleano ou lista', () => {
    const codes = (path: string) => listOrderIssues([{ path, dir: 'asc' }], FIELDS).map((one) => one.message);
    expect(codes('inexistente')).toEqual(['@core.records/list-order.issue.field-unknown']);
    for (const path of ['situacao', 'cliente', 'pago', 'etiquetas']) {
      expect(codes(path)).toEqual(['@core.records/list-order.issue.field-type']);
    }
  });

  it('recusa o campo repetido e mais chaves que o teto', () => {
    expect(listOrderIssues([{ path: 'parcela', dir: 'asc' }, { path: 'parcela', dir: 'desc' }], FIELDS)
      .map((one) => one.message)).toEqual(['@core.records/list-order.issue.duplicate']);
    const many = ['vencimento', 'parcela', 'descricao', 'createdAt'].map((path) => ({ path, dir: 'asc' }));
    expect(many.length).toBeGreaterThan(LIST_ORDER_MAX_KEYS);
    expect(listOrderIssues(many, FIELDS).map((one) => one.message)).toEqual(['@core.records/list-order.issue.too-many']);
  });
});

describe('readListOrder — a leitura tolerante do que está gravado', () => {
  it('fora de forma é "sem ordem": a lista fica como sempre esteve', () => {
    expect(readListOrder(undefined, FIELDS)).toEqual([]);
    expect(readListOrder('vencimento', FIELDS)).toEqual([]);
  });

  it('a chave que a tela não responde mais sai da ordem, e as outras continuam valendo', () => {
    expect(readListOrder([
      { path: 'apagado', dir: 'asc' },
      { path: 'vencimento', dir: 'asc' },
      { path: 'situacao', dir: 'asc' },
      { path: 'vencimento', dir: 'desc' },
      { path: 'parcela', dir: 'sideways' },
      { path: 'parcela', dir: 'desc' },
    ], FIELDS)).toEqual([{ path: 'vencimento', dir: 'asc' }, { path: 'parcela', dir: 'desc' }]);
  });
});

describe('listOrderComparator — a ordem aplicada', () => {
  it('sem chave não há comparador: a lista não muda de ordem nem deixa de paginar', () => {
    expect(listOrderComparator([])).toBeUndefined();
  });

  it('a primeira chave decide, a seguinte desempata, e o vazio vai para o fim nas duas direções', () => {
    const rows: Row[] = [
      { id: 'a', vencimento: day('2026-03-10'), parcela: 2 },
      { id: 'b', vencimento: null, parcela: 1 },
      { id: 'c', vencimento: day('2026-01-05'), parcela: 3 },
      { id: 'd', vencimento: day('2026-03-10'), parcela: 1 },
    ];
    const ascending = listOrderComparator<Row>([{ path: 'vencimento', dir: 'asc' }, { path: 'parcela', dir: 'asc' }]);
    expect(ids([...rows].sort(ascending))).toEqual(['c', 'd', 'a', 'b']);
    const descending = listOrderComparator<Row>([{ path: 'vencimento', dir: 'desc' }]);
    expect(ids([...rows].sort(descending)).at(-1)).toBe('b');
  });

  it('o empate total cai no cadastro e no id: a mesma lista sai sempre na mesma ordem', () => {
    const rows: Row[] = [
      { id: 'y', descricao: 'Aluguel', createdAt: day('2026-01-01') },
      { id: 'x', descricao: 'Aluguel', createdAt: day('2026-01-01') },
      { id: 'z', descricao: 'Aluguel', createdAt: day('2026-02-01') },
    ];
    const compare = listOrderComparator<Row>([{ path: 'descricao', dir: 'asc' }]);
    expect(ids([...rows].sort(compare))).toEqual(['x', 'y', 'z']);
    expect(ids([...rows].reverse().sort(compare))).toEqual(['x', 'y', 'z']);
  });

  it('lê o valor por onde quem chama disser — a projeção do portal o guarda em `data`', () => {
    const records = [{ id: '1', data: { parcela: 2 } }, { id: '2', data: { parcela: 1 } }];
    const compare = listOrderComparator<{ id: string; data: Record<string, unknown> }>(
      [{ path: 'parcela', dir: 'asc' }],
      (record, path) => record.data[path],
    );
    expect([...records].sort(compare).map((record) => record.id)).toEqual(['2', '1']);
  });
});

describe('guestListOrder — o que sai para o convidado do portal', () => {
  it('só chave de campo exposto, e sem o cadastro, que a projeção não guarda', () => {
    const declared = [
      { path: 'parcela', dir: 'asc' },
      { path: 'vencimento', dir: 'asc' },
      { path: 'createdAt', dir: 'desc' },
      { path: 'updatedAt', dir: 'desc' },
    ];
    expect(guestListOrder(declared, FIELDS, new Set(['vencimento']))).toEqual([
      { path: 'vencimento', dir: 'asc' },
      { path: 'updatedAt', dir: 'desc' },
    ]);
  });
});
