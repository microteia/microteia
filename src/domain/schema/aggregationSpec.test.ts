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
    expect(targets.map((t) => t.parentPath).sort()).toEqual(['values.qtdItens', 'values.totalItens']);
    expect(targets[0].parentTable).toBe('vendas');
  });

  it('usa customValues quando o pai é uma entidade fixa', () => {
    const targets = collectAggregationsFor(ctx, 'vendas');
    expect(targets).toHaveLength(1);
    expect(targets[0].parentTable).toBe('persons');
    expect(targets[0].parentPath).toBe('customValues.totalVendas');
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

  it('agregado vazio: soma é 0, mas média/mínimo/máximo são nulos', () => {
    expect(applyAggregationOp('sum', [])).toBe(0);
    expect(applyAggregationOp('count', [])).toBe(0);
    expect(applyAggregationOp('avg', [])).toBe(null);
    expect(applyAggregationOp('min', [])).toBe(null);
  });
});

describe('aggregateChildren', () => {
  const children = [
    { screenKey: 'itens', values: { total: 10, status: 'ativo' } },
    { screenKey: 'itens', values: { total: 20, status: 'cancelado' } },
    { screenKey: 'itens', values: { total: 5, status: 'ativo' } },
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
  it('lê sob values numa tela dinâmica', () => {
    expect(readChildField(ctx, 'itens', { screenKey: 'itens', values: { venda: 'v1' } }, 'venda')).toBe('v1');
  });

  it('lê na raiz numa entidade fixa', () => {
    expect(readChildField(ctx, 'persons', { name: 'Ana' }, 'name')).toBe('Ana');
  });
});
