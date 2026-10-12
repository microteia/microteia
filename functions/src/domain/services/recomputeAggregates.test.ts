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
  schema: SchemaScreen[] = screens,
): Harness => {
  const updates: Harness['updates'] = [];
  const queries: Harness['queries'] = [];

  return {
    updates,
    queries,
    deps: {
      screenProvider: fakeScreenProvider(schema),
      queryRepository: {
        queryByEquality: async (_tenantId, collection, filters) => {
          queries.push({ collection, filters });
          return children;
        },
      },
      mutationRepository: {
        getById: async (_tenantId, _collection, id) => parents[id] ?? null,
        newId: () => 'novo',
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

  it('grava o agregado mesmo quando uma regra do campo o recusa — o valor de antes seria falso', async () => {
    const vigiado = screens.map((screen) => (screen.id !== 'vendas' ? screen : {
      ...screen,
      fields: screen.fields.map((one) => (one.key !== 'totalItens' ? one : {
        ...one,
        logic: { validate: 'value > 30' },
      })),
    }));
    const h = harness({ v1: { numero: '001', totalItens: 10 } }, [
      item('i1', 'v1', 10),
      item('i2', 'v1', 25),
    ], vigiado);

    await recomputeAggregatesForChildChange('t1', 'itens', null, { venda: 'v1', total: 25 }, h.deps);

    expect(h.updates).toHaveLength(1);
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

describe('recomputeAggregatesForChildChange — latest', () => {
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
            orderBy: [{ path: 'data', dir: 'desc' }],
            filter: 'tipo == "Decisão"',
          },
        }),
        field({
          key: 'etiquetas',
          label: 'Etiquetas',
          type: 'select',
          multi: true,
          aggregation: {
            from: 'movimentos',
            via: 'processo',
            op: 'latest',
            field: 'etiquetas',
            orderBy: [{ path: 'data', dir: 'desc' }],
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
        field({ key: 'resultado', label: 'Resultado', type: 'select', lookupCollection: 'resultados' }),
        field({ key: 'etiquetas', label: 'Etiquetas', type: 'select', multi: true }),
        field({ key: 'nota', label: 'Nota' }),
      ],
    },
  ];

  /** Um banco em memória: a consulta filtra de verdade pelo vínculo, e a gravação muda o pai. */
  const store = (
    parents: Record<string, Record<string, unknown>>,
    children: WorkflowQueryRow[],
  ) => {
    const updates: { id: string; data: Record<string, unknown> }[] = [];
    const queried: string[] = [];
    const deps: AggregateRecomputeDeps = {
      screenProvider: fakeScreenProvider(latestScreens),
      queryRepository: {
        queryByEquality: async (_tenantId, _collection, filters) => {
          queried.push(String(filters[0]?.value));
          return children.filter((row) => filters.every((one) => row.data[one.path] === one.value));
        },
      },
      mutationRepository: {
        getById: async (_tenantId, _collection, id) => parents[id] ?? null,
        newId: () => 'novo',
        create: async () => 'novo',
        update: async (_tenantId, _collection, id, data) => {
          updates.push({ id, data });
          parents[id] = { ...parents[id], ...data };
        },
        delete: async () => undefined,
      },
    };
    return { deps, updates, queried, parents, children };
  };

  const mov = (id: string, data: Record<string, unknown>): WorkflowQueryRow =>
    ({ id, data: { processo: 'p1', tipo: 'Decisão', ...data } });

  const run = (
    s: ReturnType<typeof store>,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ) => recomputeAggregatesForChildChange('t1', 'movimentos', before, after, s.deps);

  it('o pai fica com o valor do filho mais recente; apagar o mais recente volta ao anterior; apagar o último esvazia', async () => {
    const a = mov('a', { data: '2026-01-10', resultado: 'procedente' });
    const b = mov('b', { data: '2026-01-11', resultado: 'improcedente' });
    const s = store({ p1: { numero: '1' } }, [a, b]);

    await run(s, null, b.data);
    expect(s.parents.p1.resultado).toBe('improcedente');

    s.children.splice(s.children.indexOf(b), 1);
    await run(s, b.data, null);
    expect(s.parents.p1.resultado).toBe('procedente');

    s.children.splice(s.children.indexOf(a), 1);
    await run(s, a.data, null);
    expect(s.parents.p1.resultado).toBeNull();
  });

  it('o filho que deixa de passar no filtro sai da conta', async () => {
    const a = mov('a', { data: '2026-01-10', resultado: 'procedente' });
    const b = mov('b', { data: '2026-01-11', resultado: 'improcedente' });
    const s = store({ p1: { resultado: 'improcedente' } }, [a, b]);

    const before = { ...b.data };
    b.data = { ...b.data, tipo: 'Despacho' };
    await run(s, before, b.data);

    expect(s.parents.p1.resultado).toBe('procedente');
  });

  it('o filho que troca de pai recalcula os dois', async () => {
    const a = mov('a', { data: '2026-01-10', resultado: 'procedente' });
    const b = mov('b', { processo: 'p2', data: '2026-01-11', resultado: 'improcedente' });
    const s = store({ p1: { resultado: 'improcedente' }, p2: {} }, [a, b]);

    await run(s, { ...b.data, processo: 'p1' }, b.data);

    expect(new Set(s.queried)).toEqual(new Set(['p1', 'p2']));
    expect(s.parents.p1.resultado).toBe('procedente');
    expect(s.parents.p2.resultado).toBe('improcedente');
  });

  it('mudar só a chave do orderBy recalcula — é ela que decide quem é o mais recente', async () => {
    const a = mov('a', { data: '2026-01-10', resultado: 'procedente' });
    const b = mov('b', { data: '2026-01-11', resultado: 'improcedente' });
    const s = store({ p1: { resultado: 'improcedente', etiquetas: null } }, [a, b]);

    const before = { ...a.data };
    a.data = { ...a.data, data: '2026-01-12' };
    await run(s, before, a.data);

    expect(s.parents.p1.resultado).toBe('procedente');
  });

  it('gravar de novo o filho sem mudar nada não regrava o pai — nem com lista', async () => {
    const a = mov('a', { data: '2026-01-10', resultado: 'procedente', etiquetas: ['x', 'y'] });
    const s = store({ p1: { resultado: 'procedente', etiquetas: ['x', 'y'] } }, [a]);

    await run(s, { ...a.data }, { ...a.data, nota: 'outra' });
    await run(s, null, { ...a.data, etiquetas: ['x', 'y'] });

    expect(s.queried.length).toBeGreaterThan(0);
    expect(s.updates).toHaveLength(0);
  });
});
