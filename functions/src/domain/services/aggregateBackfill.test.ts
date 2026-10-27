import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import type { SchemaScreen } from '../schema/pathResolver';
import { createSchemaContext } from '../schema/pathResolver';
import type { WorkflowQueryRow } from '../repositories/IWorkflowQueryRepository';
import type { AggregateBackfillParent, IAggregateBackfillRepository } from '../repositories/IAggregateBackfillRepository';
import {
  AGGREGATE_BACKFILL_MAX_ATTEMPTS,
  AGGREGATE_BACKFILL_VIA,
  declaredAggregationSignatures,
  readAggregateBackfillState,
} from '../schema/aggregateBackfill';
import type { AggregateBackfillState } from '../schema/aggregateBackfill';
import { fakeScreenProvider } from '../repositories/fakeScreenProvider';
import {
  AGGREGATE_BACKFILL_LEASE_MS,
  AGGREGATE_BACKFILL_PAGE_SIZE,
  claimAggregateBackfillRound,
  completeAggregateBackfillRound,
  isAggregateBackfillWrite,
  reconcileAggregateBackfills,
  runAggregateBackfillRound,
} from './aggregateBackfill';
import type { AggregateBackfillDeps, AggregateBackfillRoundResult } from './aggregateBackfill';

const field = (overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label'>): FieldDefinition => ({
  type: 'text',
  required: false,
  order: 0,
  origin: 'design',
  ...overrides,
});

const vendas = (extra: FieldDefinition[] = []): SchemaScreen => ({
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
    field({ key: 'resumo', label: 'Resumo', logic: { compute: "concat('Total: ', totalItens)" } }),
    ...extra,
  ],
});

const itens: SchemaScreen = {
  id: 'itens',
  titleSingular: 'Item',
  titleFieldKey: 'descricao',
  fields: [
    field({ key: 'descricao', label: 'Descrição' }),
    field({ key: 'venda', label: 'Venda', type: 'reference', refEntity: 'vendas' }),
    field({ key: 'total', label: 'Total', type: 'currency' }),
  ],
};

const NOW = 5_000_000;

interface World {
  deps: AggregateBackfillDeps;
  jobs: Map<string, AggregateBackfillState>;
  parents: Map<string, Record<string, unknown>>;
  writes: { id: string; payload: Record<string, unknown> }[];
  finished: AggregateBackfillState[];
}

const world = (
  screens: SchemaScreen[],
  parents: Record<string, Record<string, unknown>>,
  children: WorkflowQueryRow[],
  options: { failOn?: string } = {},
): World => {
  const jobs = new Map<string, AggregateBackfillState>();
  const parentMap = new Map(Object.entries(parents));
  const writes: World['writes'] = [];
  const finished: AggregateBackfillState[] = [];

  const repository: IAggregateBackfillRepository = {
    listStates: async () => new Map(jobs),
    update: async (_tenantId, table, mutate) => {
      const next = mutate(jobs.get(table) ?? null);
      if (next) jobs.set(table, next);
      return next;
    },
    listParents: async (_tenantId, _collection, afterId, limit) => {
      const ids = [...parentMap.keys()].sort();
      const from = afterId ? ids.findIndex((id) => id > afterId) : 0;
      return (from < 0 ? [] : ids.slice(from, from + limit))
        .map((id): AggregateBackfillParent => ({ id, data: parentMap.get(id) ?? {} }));
    },
    writeParent: async (_tenantId, _collection, id, payload) => {
      if (id === options.failOn) throw new Error('falha de gravação');
      writes.push({ id, payload });
      parentMap.set(id, { ...parentMap.get(id), ...payload });
    },
  };

  const provider = fakeScreenProvider(screens);
  return {
    jobs,
    parents: parentMap,
    writes,
    finished,
    deps: {
      screenProvider: provider,
      queryRepository: {
        queryByEquality: async (_tenantId, _collection, filters) =>
          children.filter((child) => child.data.venda === filters[0].value),
      },
      mutationRepository: {
        getById: async () => null,
        newId: () => 'novo',
        findKeyHolders: async () => new Map<string, string>(),
        create: async () => 'novo',
        update: async () => undefined,
        delete: async () => undefined,
      },
      backfillRepository: repository,
      freshSchemaContext: (tenantId) => provider.getSchemaContext(tenantId),
      now: () => NOW,
      recordPassFinished: async (_tenantId, _table, state) => {
        finished.push(state);
      },
    },
  };
};

const item = (id: string, venda: string, total: number): WorkflowQueryRow => ({ id, data: { venda, total } });

/** Roda rodadas como o gatilho rodaria: uma por gravação, até a passada sair de `running`. */
const drain = async (w: World, table = 'vendas'): Promise<number> => {
  let rounds = 0;
  while (w.jobs.get(table)?.status === 'running' && rounds < 100) {
    await runAggregateBackfillRound('t1', table, w.deps);
    rounds += 1;
  }
  return rounds;
};

describe('a porta automática', () => {
  it('preenche os pais que já existiam quando o agregado foi declarado', async () => {
    const w = world([vendas(), itens], { v1: { numero: '1' }, v2: { numero: '2' } }, [
      item('i1', 'v1', 10),
      item('i2', 'v1', 5),
      item('i3', 'v2', 7),
    ]);

    expect(await reconcileAggregateBackfills('t1', w.deps)).toBe(1);
    await drain(w);

    expect(w.parents.get('v1')?.totalItens).toBe(15);
    expect(w.parents.get('v2')?.totalItens).toBe(7);
    expect(w.jobs.get('vendas')?.status).toBe('done');
  });

  it('recalcula também o `compute` que depende do agregado, no mesmo write', async () => {
    const w = world([vendas(), itens], { v1: {} }, [item('i1', 'v1', 10)]);
    await reconcileAggregateBackfills('t1', w.deps);
    await drain(w);

    expect(w.writes).toHaveLength(1);
    expect(w.writes[0].payload).toEqual({ totalItens: 10, resumo: 'Total: 10' });
  });

  it('não grava o pai cujo valor já está certo', async () => {
    const w = world([vendas(), itens], { v1: { totalItens: 10, resumo: 'Total: 10' } }, [item('i1', 'v1', 10)]);
    await reconcileAggregateBackfills('t1', w.deps);
    await drain(w);

    expect(w.writes).toEqual([]);
    expect(w.finished[0].written).toBe(0);
  });

  it('chamada de novo, não refaz nada — as telas que já funcionavam ficam de fora', async () => {
    const w = world([vendas(), itens], { v1: {} }, [item('i1', 'v1', 10)]);
    await reconcileAggregateBackfills('t1', w.deps);
    await drain(w);

    expect(await reconcileAggregateBackfills('t1', w.deps)).toBe(0);
  });

  it('um agregado novo na mesma tela recalcula só ele', async () => {
    const w = world([vendas(), itens], { v1: {} }, [item('i1', 'v1', 10), item('i2', 'v1', 3)]);
    await reconcileAggregateBackfills('t1', w.deps);
    await drain(w);

    const quantidade = field({
      key: 'quantidade',
      label: 'Quantidade',
      type: 'number',
      aggregation: { from: 'itens', via: 'venda', op: 'count' },
    });
    const w2 = world([vendas([quantidade]), itens], Object.fromEntries(w.parents), [item('i1', 'v1', 10), item('i2', 'v1', 3)]);
    for (const [table, state] of w.jobs) w2.jobs.set(table, state);

    await reconcileAggregateBackfills('t1', w2.deps);
    expect(Object.keys(w2.jobs.get('vendas')?.pending ?? {})).toEqual(['quantidade']);
    await drain(w2);

    expect(w2.writes).toEqual([{ id: 'v1', payload: { quantidade: 2 } }]);
  });

  it('percorre a coleção em páginas, retomando do cursor', async () => {
    const parents = Object.fromEntries(
      Array.from({ length: AGGREGATE_BACKFILL_PAGE_SIZE + 5 }, (_, index) => [`p${String(index).padStart(4, '0')}`, {}]),
    );
    const w = world([vendas(), itens], parents, []);
    await reconcileAggregateBackfills('t1', w.deps);

    expect(await drain(w)).toBe(2);
    expect(w.finished[0].processed).toBe(AGGREGATE_BACKFILL_PAGE_SIZE + 5);
  });

  it('espera a tela dos filhos que ainda não chegou', async () => {
    const w = world([vendas()], { v1: {} }, []);
    await reconcileAggregateBackfills('t1', w.deps);
    await drain(w);

    expect(w.jobs.get('vendas')?.status).toBe('blocked');
    expect(w.jobs.get('vendas')?.blocked).toEqual([{ field: 'totalItens', from: 'itens' }]);
  });
});

describe('falhas', () => {
  it('um pai que falha não para a passada; ela é tentada de novo e, esgotada, para com a contagem', async () => {
    const w = world([vendas(), itens], { v1: {}, v2: {} }, [item('i1', 'v1', 10), item('i2', 'v2', 4)], { failOn: 'v1' });
    await reconcileAggregateBackfills('t1', w.deps);
    await drain(w);

    const job = w.jobs.get('vendas');
    expect(job?.status).toBe('done');
    expect(job?.attempts).toBe(AGGREGATE_BACKFILL_MAX_ATTEMPTS);
    expect(job?.failed).toBe(1);
    expect(job?.failedIds).toEqual(['v1']);
    expect(job?.reconciled).toEqual({});
    expect(w.parents.get('v2')?.totalItens).toBe(4);
    expect(await reconcileAggregateBackfills('t1', w.deps)).toBe(0);
  });
});

describe('a reserva da rodada', () => {
  const running = (overrides: Partial<AggregateBackfillState> = {}): AggregateBackfillState => ({
    ...readAggregateBackfillState({}),
    status: 'running',
    ...overrides,
  });

  it('não é tomada por uma segunda entrega enquanto vale', () => {
    const claimed = claimAggregateBackfillRound(running(), NOW);
    expect(claimed?.leaseUntil).toBe(NOW + AGGREGATE_BACKFILL_LEASE_MS);
    expect(claimAggregateBackfillRound(claimed as AggregateBackfillState, NOW + 1)).toBeNull();
  });

  it('é retomada depois de vencer', () => {
    const claimed = claimAggregateBackfillRound(running(), NOW) as AggregateBackfillState;
    expect(claimAggregateBackfillRound(claimed, NOW + AGGREGATE_BACKFILL_LEASE_MS + 1)).not.toBeNull();
  });

  it('a rodada de uma passada abandonada não grava sobre a seguinte', () => {
    const result: AggregateBackfillRoundResult = {
      processed: 1, written: 1, truncated: 0, failed: 0, failedIds: [], nextCursor: null, blocked: [],
    };
    const restarted = running({ generation: 2 });
    expect(completeAggregateBackfillRound(restarted, { generation: 1, round: 0 }, result, NOW)).toBeNull();
  });
});

describe('a gravação do recálculo — o que não publica evento nem auditoria', () => {
  const ctx = createSchemaContext([vendas(), itens]);
  const before = { numero: '1', totalItens: null, updatedAt: 'ontem', updatedVia: 'ui' };

  it('é a que traz a marca e só muda campos derivados', () => {
    const after = { ...before, totalItens: 10, resumo: 'Total: 10', updatedBy: 'aggregate-engine', updatedVia: AGGREGATE_BACKFILL_VIA };
    expect(isAggregateBackfillWrite(ctx, 'vendas', before, after)).toBe(true);
  });

  it('não é a que muda um campo de negócio, mesmo com a marca', () => {
    const after = { ...before, numero: '2', totalItens: 10, updatedVia: AGGREGATE_BACKFILL_VIA };
    expect(isAggregateBackfillWrite(ctx, 'vendas', before, after)).toBe(false);
  });

  it('não é a do motor vivo depois do recálculo — a marca ficou, mas `updatedAt` mudou', () => {
    const marked = { ...before, updatedVia: AGGREGATE_BACKFILL_VIA };
    const after = { ...marked, totalItens: 12, updatedAt: 'hoje' };
    expect(isAggregateBackfillWrite(ctx, 'vendas', marked, after)).toBe(false);
  });

  it('não é a que não traz a marca', () => {
    const after = { ...before, totalItens: 10 };
    expect(isAggregateBackfillWrite(ctx, 'vendas', before, after)).toBe(false);
  });
});

describe('coleção descrita por uma tela de chave diferente', () => {
  const anchor: SchemaScreen = { id: 'vendas', origin: 'builtin', titleSingular: 'vendas', titleFieldKey: '', fields: [] };
  const bound = (): SchemaScreen => ({ ...vendas(), id: 'painelVendas', collection: 'vendas' });

  it.each([
    ['a âncora chega antes da tela', () => [anchor, bound(), itens]],
    ['a âncora chega depois da tela', () => [bound(), anchor, itens]],
  ])('o job é o da coleção e recalcula os pais quando %s', async (_, schema) => {
    const w = world(schema(), { v1: {} }, [item('i1', 'v1', 10), item('i2', 'v1', 5)]);

    expect(await reconcileAggregateBackfills('t1', w.deps)).toBe(1);
    expect(Object.keys(w.jobs.get('vendas')?.pending ?? {})).toEqual(['totalItens']);
    expect(w.jobs.has('painelVendas')).toBe(false);
    await drain(w);

    expect(w.parents.get('v1')?.totalItens).toBe(15);
  });

  it('o estado deixado pela chave errada não impede a passada: a coleção volta a ter o que recalcular', async () => {
    const w = world([anchor, bound(), itens], { v1: {} }, [item('i1', 'v1', 10)]);
    const signature = declaredAggregationSignatures(vendas().fields);
    // O que o defeito gravou: a coleção esvaziada pelo `settle` e a chave da tela "recalculada" sem
    // ter tocado em pai nenhum.
    w.jobs.set('vendas', { ...readAggregateBackfillState({}), status: 'done', reconciled: {} });
    w.jobs.set('painelVendas', { ...readAggregateBackfillState({}), status: 'done', reconciled: signature });

    await reconcileAggregateBackfills('t1', w.deps);
    expect(w.jobs.get('vendas')?.status).toBe('running');
    expect(w.jobs.get('painelVendas')?.reconciled).toEqual({});
    await drain(w);

    expect(w.parents.get('v1')?.totalItens).toBe(10);
  });
});
