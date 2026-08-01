import { describe, it, expect } from 'vitest';
import { makeQueryStepDefinition } from './QueryStep';
import type {
  IWorkflowQueryRepository,
  WorkflowEqualityFilter,
  WorkflowQueryRow,
} from '../../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../../domain/repositories/IWorkflowRecordFetcher';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import type { SchemaScreen } from '../../../domain/schema/pathResolver';
import type { QuerySpec } from '../../../domain/schema/querySpec';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { WorkflowEvent } from '../../../domain/entities/Workflow';
import { fakeScreenProvider } from '../../../domain/repositories/fakeScreenProvider';

const personsScreen: SchemaScreen = {
  id: 'persons',
  titleSingular: 'Pessoa',
  titleFieldKey: 'name',
  fields: [{ key: 'apelido', label: 'Apelido', type: 'text', required: false, order: 0, origin: 'design' }],
};

// Contrato vem de extensão: é a tela que descreve a coleção consultada e a relação com Pessoa.
const contractsScreen: SchemaScreen = {
  id: 'contratos',
  collection: 'contracts',
  eventPrefix: 'contract',
  titleSingular: 'Contrato',
  titleFieldKey: 'title',
  fields: [
    { key: 'status', label: 'Status', type: 'text', required: false, order: 0, origin: 'plugin' },
    { key: 'totalValue', label: 'Valor total', type: 'currency', required: false, order: 1, origin: 'plugin' },
    { key: 'clientId', label: 'Cliente', type: 'reference', refEntity: 'persons', refDenormKey: 'client', required: false, order: 2, origin: 'plugin' },
  ],
};

interface QueryCall {
  collection: string;
  equalityFilters: WorkflowEqualityFilter[];
}

class FakeQueryRepository implements IWorkflowQueryRepository {
  calls: QueryCall[] = [];
  constructor(private readonly rows: WorkflowQueryRow[]) {}
  async queryByEquality(
    _tenantId: string,
    collection: string,
    equalityFilters: WorkflowEqualityFilter[],
  ): Promise<WorkflowQueryRow[]> {
    this.calls.push({ collection, equalityFilters });
    return this.rows;
  }
}

class FakeFetcher implements IWorkflowRecordFetcher {
  calls: { collection: string; ids: string[] }[] = [];
  constructor(private readonly byId: Record<string, Record<string, unknown>> = {}) {}
  async fetchByIds(_tenantId: string, collection: string, ids: string[]) {
    this.calls.push({ collection, ids });
    return new Map(ids.map((id) => [id, this.byId[id] ?? null]));
  }
}

const screenProvider: IScreenDefinitionProvider = fakeScreenProvider([personsScreen, contractsScreen]);

const logger = { info: () => {}, warn: () => {}, error: () => {} };

const context = (): WorkflowContext => ({
  event: { id: 'e1', tenantId: 't1', name: 'contract.saved', payload: {}, timestamp: new Date() } as WorkflowEvent,
  outputs: {},
  variables: {},
  services: { logger, now: () => new Date() },
  logger,
  execution: { id: 'x1', workflowDefinitionId: 'w1', tenantId: 't1' },
});

const run = (
  spec: QuerySpec,
  rows: WorkflowQueryRow[],
  fetcher = new FakeFetcher(),
  repo = new FakeQueryRepository(rows),
) => {
  const definition = makeQueryStepDefinition(repo, fetcher, screenProvider);
  return { repo, fetcher, result: definition.createExecutor().execute({ query: spec }, context()) };
};

const baseSpec = (overrides: Partial<QuerySpec>): QuerySpec => ({
  table: 'contracts',
  where: [],
  orderBy: [],
  limit: 20,
  projections: [],
  ...overrides,
});

describe('QueryStep', () => {
  it('envia filtros de igualdade ao servidor e projeta FK denormalizada', async () => {
    const { repo, result } = run(
      baseSpec({
        where: [{ path: 'status', op: 'eq', value: { kind: 'Literal', value: 'ativo' } }],
        projections: ['client.name'],
      }),
      [{ id: 'c1', data: { status: 'ativo', clientId: 'p1', client: { name: 'Ana' } } }],
    );

    const outcome = await result;
    expect(outcome.success).toBe(true);
    expect(repo.calls[0].collection).toBe('contracts');
    expect(repo.calls[0].equalityFilters).toContainEqual({ path: 'status', value: 'ativo' });
    expect(outcome.outputs?.count).toBe(1);
    expect((outcome.outputs?.first as Record<string, unknown>).client).toMatchObject({ name: 'Ana' });
  });

  it('aplica operadores de intervalo em memória (não no servidor)', async () => {
    const { repo, result } = run(
      baseSpec({ where: [{ path: 'totalValue', op: 'gt', value: { kind: 'Literal', value: 1000 } }] }),
      [
        { id: 'c1', data: { totalValue: 500 } },
        { id: 'c2', data: { totalValue: 2000 } },
      ],
    );

    const outcome = await result;
    expect(repo.calls[0].equalityFilters).toEqual([]);
    expect(outcome.outputs?.count).toBe(1);
    expect((outcome.outputs?.results as { id: string }[])[0].id).toBe('c2');
  });

  it('hidrata campo declarado pelo tenant na FK quando ausente no snapshot', async () => {
    const fetcher = new FakeFetcher({ p1: { name: 'Ana', apelido: 'Aninha' } });
    const { result } = run(
      baseSpec({ projections: ['client.apelido'] }),
      [{ id: 'c1', data: { clientId: 'p1', client: { name: 'Ana' } } }],
      fetcher,
    );

    const outcome = await result;
    expect(fetcher.calls).toContainEqual({ collection: 'persons', ids: ['p1'] });
    const first = outcome.outputs?.first as Record<string, Record<string, unknown>>;
    expect(first.client.apelido).toBe('Aninha');
  });

  it('consulta a coleção da tela, sem filtro implícito nenhum', async () => {
    const withScreen: IScreenDefinitionProvider = fakeScreenProvider([
        personsScreen,
        {
          id: 'processos',
          titleSingular: 'Processo',
          titleFieldKey: 'title',
          fields: [{ key: 'title', label: 'Título', type: 'text', required: false, order: 0, origin: 'design' }],
        },
      ]);
    const repo = new FakeQueryRepository([{ id: 'r1', data: { title: 'Caso X' } }]);
    const definition = makeQueryStepDefinition(repo, new FakeFetcher(), withScreen);
    const outcome = await definition.createExecutor().execute(
      { query: baseSpec({ table: 'processos', projections: ['title'] }) },
      context(),
    );

    expect(outcome.success).toBe(true);
    expect(repo.calls[0].collection).toBe('processos');
    expect(repo.calls[0].equalityFilters).toEqual([]);
  });
});
