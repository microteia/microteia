import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import {
  aggregateChildren,
  aggregationCreatesCycle,
  applyAggregationOp,
  collectAggregationsFor,
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
  ];

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
