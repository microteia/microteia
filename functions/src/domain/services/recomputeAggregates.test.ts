import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import type { SchemaScreen } from '../schema/pathResolver';
import type { WorkflowEqualityFilter, WorkflowQueryRow } from '../repositories/IWorkflowQueryRepository';
import type { AggregateRecomputeDeps } from './recomputeAggregates';
import { recomputeAggregatesForChildChange } from './recomputeAggregates';
import { fakeScreenProvider } from '../../domain/repositories/fakeScreenProvider';

const field = (overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label'>): FieldDefinition => ({
  type: 'text',
  required: false,
  order: 0,
  origin: 'design',
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
        key: 'resumo',
        label: 'Resumo',
        logic: { compute: "concat('Total: ', totalItens)" },
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
    ],
  },
];

interface Harness {
  deps: AggregateRecomputeDeps;
  updates: { id: string; data: Record<string, unknown> }[];
  queries: { collection: string; filters: WorkflowEqualityFilter[] }[];
}

const harness = (
  parents: Record<string, Record<string, unknown>>,
  children: WorkflowQueryRow[],
): Harness => {
  const updates: Harness['updates'] = [];
  const queries: Harness['queries'] = [];

  return {
    updates,
    queries,
    deps: {
      screenProvider: fakeScreenProvider(screens),
      queryRepository: {
        queryByEquality: async (_tenantId, collection, filters) => {
          queries.push({ collection, filters });
          return children;
        },
      },
      mutationRepository: {
        getById: async (_tenantId, _collection, id) => parents[id] ?? null,
        create: async () => 'novo',
        update: async (_tenantId, _collection, id, data) => {
          updates.push({ id, data });
        },
        delete: async () => undefined,
      },
    },
  };
};

const item = (id: string, venda: string, total: number): WorkflowQueryRow => ({
  id,
  data: { venda, total },
});

describe('recomputeAggregatesForChildChange', () => {
  it('soma os filhos e grava o total no pai', async () => {
    const h = harness({ v1: { numero: '001' } }, [
      item('i1', 'v1', 10),
      item('i2', 'v1', 25),
    ]);

    await recomputeAggregatesForChildChange(
      't1',
      'itens',
      null,
      { venda: 'v1', total: 25 },
      h.deps,
    );

    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].id).toBe('v1');
    expect(h.updates[0].data.totalItens).toBe(35);
  });

  it('consulta a coleção do filho, filtrando só pelo vínculo com o pai', async () => {
    const h = harness({ v1: {} }, [item('i1', 'v1', 10)]);

    await recomputeAggregatesForChildChange(
      't1',
      'itens',
      null,
      { venda: 'v1', total: 10 },
      h.deps,
    );

    expect(h.queries[0].collection).toBe('itens');
    expect(h.queries[0].filters).toEqual([{ path: 'venda', value: 'v1' }]);
  });

  it('não grava quando o total já está correto — é a guarda que encerra a cascata', async () => {
    const h = harness({ v1: { totalItens: 35, resumo: 'Total: 35' } }, [
      item('i1', 'v1', 10),
      item('i2', 'v1', 25),
    ]);

    await recomputeAggregatesForChildChange(
      't1',
      'itens',
      { venda: 'v1', total: 24 },
      { venda: 'v1', total: 25 },
      h.deps,
    );

    expect(h.updates).toHaveLength(0);
  });

  it('recalcula o pai antigo E o novo quando o filho troca de pai', async () => {
    const h = harness(
      { v1: {}, v2: {} },
      [item('i1', 'v2', 10)],
    );

    await recomputeAggregatesForChildChange(
      't1',
      'itens',
      { venda: 'v1', total: 10 },
      { venda: 'v2', total: 10 },
      h.deps,
    );

    expect(h.updates.map((u) => u.id).sort()).toEqual(['v1', 'v2']);
  });

  it('exclusão do filho baixa o total do pai', async () => {
    const h = harness({ v1: { totalItens: 35 } }, [item('i1', 'v1', 10)]);

    await recomputeAggregatesForChildChange(
      't1',
      'itens',
      { venda: 'v1', total: 25 },
      null,
      h.deps,
    );

    expect(h.updates[0].data.totalItens).toBe(10);
  });

  it('recalcula o campo `compute` do pai que depende do agregado', async () => {
    const h = harness({ v1: {} }, [item('i1', 'v1', 42)]);

    await recomputeAggregatesForChildChange(
      't1',
      'itens',
      null,
      { venda: 'v1', total: 42 },
      h.deps,
    );

    expect(h.updates[0].data.resumo).toBe('Total: 42');
  });

  it('ignora a mudança que não afeta o agregado, sem consultar os filhos', async () => {
    const h = harness({ v1: {} }, [item('i1', 'v1', 10)]);

    await recomputeAggregatesForChildChange(
      't1',
      'itens',
      { venda: 'v1', total: 10, descricao: 'antes' },
      { venda: 'v1', total: 10, descricao: 'depois' },
      h.deps,
    );

    expect(h.queries).toHaveLength(0);
    expect(h.updates).toHaveLength(0);
  });

  it('não faz nada quando nenhuma tela agrega sobre a coleção alterada', async () => {
    const h = harness({}, []);
    await recomputeAggregatesForChildChange('t1', 'persons', null, { name: 'Ana' }, h.deps);
    expect(h.queries).toHaveLength(0);
    expect(h.updates).toHaveLength(0);
  });

  it('pai inexistente não gera gravação', async () => {
    const h = harness({}, [item('i1', 'v9', 10)]);
    await recomputeAggregatesForChildChange(
      't1',
      'itens',
      null,
      { venda: 'v9', total: 10 },
      h.deps,
    );
    expect(h.updates).toHaveLength(0);
  });
});
