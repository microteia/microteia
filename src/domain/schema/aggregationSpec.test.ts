import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import {
  aggregateChildren,
  aggregationCreatesCycle,
  applyAggregationOp,
  collectAggregationsFor,
  fieldAggregationIssues,
  readChildField,
} from './aggregationSpec';
import { createSchemaContext } from './pathResolver';
import type { SchemaScreen } from './pathResolver';

const field = (overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label'>): FieldDefinition => ({
  origin: 'design',
  type: 'text',
  required: false,
  order: 0,
  ...overrides,
});

const screens: SchemaScreen[] = [
  {
    id: 'vendas',
    titleSingular: 'Venda',
    titleFieldKey: 'numero',
    fields: [
      field({ key: 'numero', label: 'Número' }),
      field({
        key: 'totalItens',
        label: 'Total dos itens',
        type: 'currency',
        aggregation: { from: 'itens', via: 'venda', op: 'sum', field: 'total' },
      }),
      field({
        key: 'qtdItens',
        label: 'Quantidade de itens',
        type: 'number',
        aggregation: { from: 'itens', via: 'venda', op: 'count' },
      }),
    ],
  },
  {
    id: 'itens',
    titleSingular: 'Item',
    titleFieldKey: 'descricao',
    fields: [
      field({ key: 'descricao', label: 'Descrição' }),
      field({ key: 'venda', label: 'Venda', type: 'reference', refEntity: 'vendas' }),
      field({ key: 'total', label: 'Total', type: 'currency' }),
      field({ key: 'status', label: 'Status', type: 'select' }),
    ],
  },
  {
    id: 'persons',
    titleSingular: 'Pessoa',
    titleFieldKey: 'name',
    fields: [
      field({
        key: 'totalVendas',
        label: 'Total de vendas',
        type: 'currency',
        aggregation: { from: 'vendas', via: 'cliente', op: 'sum', field: 'totalItens' },
      }),
    ],
  },
];

const ctx = createSchemaContext(screens);

describe('collectAggregationsFor', () => {
  it('encontra os campos que agregam sobre a tela filha, com o caminho de escrita no pai', () => {
    const targets = collectAggregationsFor(ctx, 'itens');
    expect(targets).toHaveLength(2);
    expect(targets.map((t) => t.parentPath).sort()).toEqual(['qtdItens', 'totalItens']);
    expect(targets[0].parentTable).toBe('vendas');
  });

  it('grava no próprio campo também quando o pai é uma entidade fixa', () => {
    const targets = collectAggregationsFor(ctx, 'vendas');
    expect(targets).toHaveLength(1);
    expect(targets[0].parentTable).toBe('persons');
    expect(targets[0].parentPath).toBe('totalVendas');
  });

  it('devolve vazio para uma tela da qual ninguém agrega', () => {
    expect(collectAggregationsFor(ctx, 'persons')).toEqual([]);
  });
});

describe('aggregationCreatesCycle', () => {
  it('aceita uma cadeia sem ciclo', () => {
    expect(aggregationCreatesCycle(ctx, 'persons', 'vendas')).toBe(false);
  });

  it('recusa a autoagregação', () => {
    expect(aggregationCreatesCycle(ctx, 'itens', 'itens')).toBe(true);
  });

  it('recusa o ciclo indireto (itens agregaria de persons, que agrega de vendas, que vem de itens)', () => {
    expect(aggregationCreatesCycle(ctx, 'itens', 'persons')).toBe(true);
  });
});

describe('applyAggregationOp', () => {
  it('soma, conta, faz média, mínimo e máximo', () => {
    const values = [10, '20', 30];
    expect(applyAggregationOp('sum', values)).toBe(60);
    expect(applyAggregationOp('count', values)).toBe(3);
    expect(applyAggregationOp('avg', values)).toBe(20);
    expect(applyAggregationOp('min', values)).toBe(10);
    expect(applyAggregationOp('max', values)).toBe(30);
  });

  it('ignora valores não numéricos', () => {
    expect(applyAggregationOp('sum', [10, null, 'abc', undefined, 5])).toBe(15);
  });

  it('um valor que é LISTA entra pelos itens dele', () => {
    // O caminho que atravessa uma referência de vários colhe um número por apontado. `Number([10,
    // 20])` é `NaN`: sem entrar pelos itens, a soma respondia 0 com a cara de um total legítimo.
    expect(applyAggregationOp('sum', [[10, 20], 5])).toBe(35);
    expect(applyAggregationOp('avg', [[10, 20], 30])).toBe(20);
    expect(applyAggregationOp('max', [[10, 20]])).toBe(20);
    // `count` continua contando REGISTROS, não itens: é a contagem de linhas do grupo.
    expect(applyAggregationOp('count', [[10, 20], 5])).toBe(2);
  });

  it('agregado vazio: soma é 0, mas média/mínimo/máximo são nulos', () => {
    expect(applyAggregationOp('sum', [])).toBe(0);
    expect(applyAggregationOp('count', [])).toBe(0);
    expect(applyAggregationOp('avg', [])).toBe(null);
    expect(applyAggregationOp('min', [])).toBe(null);
  });
});

describe('aggregateChildren', () => {
  const children = [
    { total: 10, status: 'ativo' },
    { total: 20, status: 'cancelado' },
    { total: 5, status: 'ativo' },
  ].map((data, index) => ({ id: `i${index}`, data }));

  it('soma o campo declarado sobre os filhos', () => {
    const target = collectAggregationsFor(ctx, 'itens').find((t) => t.fieldKey === 'totalItens')!;
    expect(aggregateChildren(ctx, target.aggregation, 'itens', children)).toBe(35);
  });

  it('conta os filhos sem exigir campo', () => {
    const target = collectAggregationsFor(ctx, 'itens').find((t) => t.fieldKey === 'qtdItens')!;
    expect(aggregateChildren(ctx, target.aggregation, 'itens', children)).toBe(3);
  });

  it('aplica o filtro sobre o escopo do filho', () => {
    const aggregation = { from: 'itens', via: 'venda', op: 'sum' as const, field: 'total', filter: "status == 'ativo'" };
    expect(aggregateChildren(ctx, aggregation, 'itens', children)).toBe(15);
  });

  it('filtro inválido reprova o filho em vez de contá-lo', () => {
    const aggregation = { from: 'itens', via: 'venda', op: 'count' as const, filter: 'funcaoInexistente(1)' };
    expect(aggregateChildren(ctx, aggregation, 'itens', children)).toBe(0);
  });

  it('sem filhos, a soma é zero', () => {
    const target = collectAggregationsFor(ctx, 'itens').find((t) => t.fieldKey === 'totalItens')!;
    expect(aggregateChildren(ctx, target.aggregation, 'itens', [])).toBe(0);
  });
});

describe('readChildField', () => {
  it('lê o campo na raiz do registro filho', () => {
    expect(readChildField(ctx, 'itens', { venda: 'v1' }, 'venda')).toBe('v1');
  });

  it('lê na raiz numa entidade fixa', () => {
    expect(readChildField(ctx, 'persons', { name: 'Ana' }, 'name')).toBe('Ana');
  });
});

describe('latest — valor do filho mais recente', () => {
  const latestScreens: SchemaScreen[] = [
    {
      id: 'processos',
      titleSingular: 'Processo',
      titleFieldKey: 'numero',
      fields: [
        field({ key: 'numero', label: 'Número' }),
        field({
          key: 'resultado',
          label: 'Resultado',
          type: 'select',
          lookupCollection: 'resultados',
          aggregation: {
            from: 'movimentos',
            via: 'processo',
            op: 'latest',
            field: 'resultado',
            orderBy: [{ path: 'data', dir: 'desc' }, { path: 'hora', dir: 'desc' }],
            filter: 'tipo == "Decisão" and resultado != ""',
          },
        }),
      ],
    },
    {
      id: 'movimentos',
      titleSingular: 'Movimento',
      titleFieldKey: 'tipo',
      fields: [
        field({ key: 'processo', label: 'Processo', type: 'reference', refEntity: 'processos' }),
        field({ key: 'tipo', label: 'Tipo' }),
        field({ key: 'data', label: 'Data', type: 'date' }),
        field({ key: 'hora', label: 'Hora', type: 'time' }),
        field({ key: 'resultado', label: 'Resultado', type: 'select', lookupCollection: 'resultados' }),
      ],
    },
  ];
  const latestCtx = createSchemaContext(latestScreens);
  const aggregation = latestScreens[0].fields[1].aggregation!;
  const movimento = (id: string, data: Record<string, unknown>) =>
    ({ id, data: { processo: 'p1', tipo: 'Decisão', ...data } });
  const latest = (children: ReturnType<typeof movimento>[], override: Partial<typeof aggregation> = {}) =>
    aggregateChildren(latestCtx, { ...aggregation, ...override }, 'movimentos', children);

  it('copia o campo do filho mais recente, como está', () => {
    const a = movimento('a', { data: '2026-01-10', resultado: 'procedente' });
    const b = movimento('b', { data: '2026-01-11', resultado: 'improcedente' });
    expect(latest([a, b])).toBe('improcedente');
    expect(latest([b, a])).toBe('improcedente');
  });

  it('sem o mais recente, volta ao anterior; sem nenhum, fica vazio', () => {
    const a = movimento('a', { data: '2026-01-10', resultado: 'procedente' });
    expect(latest([a])).toBe('procedente');
    expect(latest([])).toBeNull();
  });

  it('na mesma data, a segunda chave do orderBy decide', () => {
    const manha = movimento('m', { data: '2026-01-10', hora: '09:00', resultado: 'parcial' });
    const tarde = movimento('t', { data: '2026-01-10', hora: '15:30', resultado: 'procedente' });
    expect(latest([manha, tarde])).toBe('procedente');
    expect(latest([tarde, manha])).toBe('procedente');
  });

  it('empate total é resolvido sempre igual: createdAt, depois o id', () => {
    const base = { data: '2026-01-10', hora: '09:00' };
    const antigo = movimento('z', { ...base, resultado: 'antigo', createdAt: new Date('2026-01-10T09:00:00Z') });
    const novo = movimento('y', { ...base, resultado: 'novo', createdAt: new Date('2026-01-10T10:00:00Z') });
    expect(latest([antigo, novo])).toBe('novo');
    expect(latest([novo, antigo])).toBe('novo');

    const x = movimento('x', { ...base, resultado: 'x' });
    const w = movimento('w', { ...base, resultado: 'w' });
    expect(latest([x, w])).toBe('w');
    expect(latest([w, x])).toBe('w');
  });

  it('o createdAt do Firestore (Timestamp) também desempata', () => {
    const stamp = (ms: number) => ({ toDate: () => new Date(ms) });
    const base = { data: '2026-01-10', hora: '09:00' };
    const um = movimento('a', { ...base, resultado: 'um', createdAt: stamp(1000) });
    const dois = movimento('b', { ...base, resultado: 'dois', createdAt: stamp(2000) });
    expect(latest([dois, um])).toBe('dois');
  });

  it('valor vazio na chave vai para o fim nas duas direções', () => {
    const semData = movimento('s', { data: '', resultado: 'sem-data' });
    const comData = movimento('c', { data: '2026-01-10', resultado: 'com-data' });
    expect(latest([semData, comData])).toBe('com-data');
    expect(latest([semData, comData], { orderBy: [{ path: 'data', dir: 'asc' }] })).toBe('com-data');
  });

  it('"primeiro" é o latest com dir asc', () => {
    const a = movimento('a', { data: '2026-01-10', resultado: 'primeiro' });
    const b = movimento('b', { data: '2026-01-11', resultado: 'segundo' });
    expect(latest([b, a], { orderBy: [{ path: 'data', dir: 'asc' }] })).toBe('primeiro');
  });

  it('o filho que não passa no filtro sai da conta', () => {
    const decisao = movimento('a', { data: '2026-01-10', resultado: 'procedente' });
    const despacho = movimento('b', { data: '2026-01-11', tipo: 'Despacho', resultado: 'outro' });
    expect(latest([decisao, despacho])).toBe('procedente');
    expect(latest([despacho])).toBeNull();
  });

  it('copia listas e ids sem converter', () => {
    const one = movimento('a', { data: '2026-01-10', resultado: ['x', 'y'] });
    expect(latest([one])).toEqual(['x', 'y']);
  });

  it('sem field ou sem orderBy, não escolhe ninguém', () => {
    const a = movimento('a', { data: '2026-01-10', resultado: 'procedente' });
    expect(latest([a], { field: null })).toBeNull();
    expect(latest([a], { orderBy: [] })).toBeNull();
  });
});

describe('fieldAggregationIssues', () => {
  const parent = { key: 'resultado', type: 'select' as const, lookupCollection: 'resultados' };
  const child = [
    { key: 'resultado', type: 'select' as const, lookupCollection: 'resultados' },
    { key: 'data', type: 'date' as const },
    { key: 'valor', type: 'currency' as const },
    { key: 'outraLista', type: 'select' as const, lookupCollection: 'outra' },
  ];
  const base = {
    from: 'movimentos',
    via: 'processo',
    op: 'latest' as const,
    field: 'resultado',
    orderBy: [{ path: 'data', dir: 'desc' as const }],
  };
  const codes = (aggregation: Parameters<typeof fieldAggregationIssues>[0], childFields = child) =>
    fieldAggregationIssues(aggregation, parent, childFields).map((one) => one.code);

  it('aceita a declaração completa', () => {
    expect(codes(base)).toEqual([]);
  });

  it('aceita ordenar por campo de sistema', () => {
    expect(codes({ ...base, orderBy: [{ path: 'createdAt', dir: 'desc' }] })).toEqual([]);
  });

  it('recusa latest sem field e sem orderBy', () => {
    expect(codes({ ...base, field: null })).toEqual(['latest-field']);
    expect(codes({ ...base, orderBy: [] })).toEqual(['latest-order']);
    expect(codes({ ...base, orderBy: null })).toEqual(['latest-order']);
  });

  it('recusa orderBy em outra operação', () => {
    expect(codes({ ...base, op: 'sum', field: 'valor' })).toEqual(['order-not-latest']);
  });

  it('recusa direção inválida', () => {
    expect(codes({ ...base, orderBy: [{ path: 'data', dir: 'down' as never }] })).toEqual(['order-dir']);
  });

  it('recusa orderBy e field que não são campos do filho', () => {
    expect(codes({ ...base, orderBy: [{ path: 'inexistente', dir: 'desc' }] })).toEqual(['unknown-order']);
    expect(codes({ ...base, field: 'inexistente' })).toEqual(['unknown-field']);
  });

  it('recusa tipo, lista ou cardinalidade incompatível', () => {
    expect(codes({ ...base, field: 'valor' })).toEqual(['type-mismatch']);
    expect(codes({ ...base, field: 'outraLista' })).toEqual(['type-mismatch']);
    expect(fieldAggregationIssues(base, { ...parent, multi: true }, child).map((one) => one.code)).toEqual(['type-mismatch']);
  });

  it('cada recusa é uma referência de mensagem', () => {
    const [found] = fieldAggregationIssues({ ...base, field: 'valor' }, parent, child);
    expect(found.message).toBe('@core.records/aggregation.issue.type-mismatch');
    expect(found.messageParams).toMatchObject({ childField: 'valor', parentType: 'select', childType: 'currency' });
  });

  it('sem os campos do filho, confere só o que não depende deles', () => {
    expect(fieldAggregationIssues({ ...base, field: 'inexistente' }, parent, null)).toEqual([]);
  });

  it('as operações numéricas continuam sem exigência nova', () => {
    expect(codes({ from: 'movimentos', via: 'processo', op: 'sum', field: 'valor' })).toEqual([]);
    expect(codes({ from: 'movimentos', via: 'processo', op: 'count' })).toEqual([]);
  });
});

describe('collectAggregationsFor — coleção descrita por uma tela de chave diferente', () => {
  const anchor: SchemaScreen = { id: 'vendas', origin: 'builtin', titleSingular: 'vendas', titleFieldKey: '', fields: [] };
  const bound: SchemaScreen = {
    id: 'painelVendas',
    collection: 'vendas',
    titleSingular: 'Venda',
    titleFieldKey: 'numero',
    fields: [
      field({ key: 'numero', label: 'Número' }),
      field({
        key: 'ultimoItem',
        label: 'Último item',
        aggregation: { from: 'itens', via: 'venda', op: 'latest', field: 'descricao', orderBy: [{ path: 'createdAt', dir: 'desc' }] },
      }),
    ],
  };
  const child = screens.find((screen) => screen.id === 'itens')!;

  it.each([
    ['a âncora chega antes da tela', [anchor, bound, child]],
    ['a âncora chega depois da tela', [bound, anchor, child]],
  ])('o pai é a coleção, e não a chave da tela, quando %s', (_, ordered) => {
    const merged = createSchemaContext(ordered);
    expect(merged.screens.get('vendas')?.id).toBe('painelVendas');

    const targets = collectAggregationsFor(merged, 'itens');
    expect(targets.map((target) => [target.parentTable, target.fieldKey])).toEqual([['vendas', 'ultimoItem']]);
  });

  it('entrega o campo cujo pai não resolve, em vez de descartá-lo calado', () => {
    const readOnly: SchemaScreen = {
      id: 'members',
      titleSingular: 'Membro',
      titleFieldKey: 'name',
      fields: [field({ key: 'qtd', label: 'Qtd', type: 'number', aggregation: { from: 'itens', via: 'venda', op: 'count' } })],
    };
    const unresolved: unknown[] = [];
    const targets = collectAggregationsFor(createSchemaContext([readOnly, child]), 'itens', (one) => unresolved.push(one));

    expect(targets).toEqual([]);
    expect(unresolved).toEqual([{ parentTable: 'members', fieldKey: 'qtd', from: 'itens' }]);
  });
});
