import { describe, expect, it } from 'vitest';
import type {
  IWorkflowQueryRepository,
  WorkflowEqualityFilter,
  WorkflowQueryPage,
  WorkflowQueryRow,
} from '../../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../../domain/repositories/IWorkflowRecordFetcher';
import type { SchemaScreen } from '../../../domain/schema/pathResolver';
import type { QuerySpec } from '../../../domain/schema/querySpec';
import { QUERY_MAX_RESULTS } from '../../../domain/schema/querySpec';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { WorkflowEvent } from '../../../domain/entities/Workflow';
import { fakeScreenProvider } from '../../../domain/repositories/fakeScreenProvider';
import type { WorkflowQueryLimits, WorkflowQueryResult } from './runWorkflowQuery';
import { runRecordQuery } from './runWorkflowQuery';
import { makeQueryStepDefinition } from '../steps/QueryStep';
import { compareDocumentIds } from './documentIdOrder';

/**
 * A consulta lida em páginas. O que estes testes provam é a promessa que justifica o recurso: percorrer
 * a coleção página a página entrega CADA registro que atende uma vez — nenhum pulado, nenhum repetido —,
 * com filtro em memória, com o corte do `limit` no meio da janela e com a varredura de quem a
 * visibilidade restringe. E que, sem `page`, nada muda.
 */

const destinatarios: SchemaScreen = {
  id: 'destinatarios',
  titleSingular: 'Destinatário',
  titleFieldKey: 'nome',
  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: false, order: 0, origin: 'design' },
    { key: 'lote', label: 'Lote', type: 'text', required: false, order: 1, origin: 'design' },
    { key: 'valor', label: 'Valor', type: 'number', required: false, order: 2, origin: 'design' },
    { key: 'responsavel', label: 'Responsável', type: 'reference', refEntity: 'members', required: false, order: 3, origin: 'design' },
  ],
};

const restritos: SchemaScreen = { ...destinatarios, id: 'restritos', memberVisibility: { userFields: ['responsavel'] } };

const screenProvider = fakeScreenProvider([destinatarios, restritos]);

/** Ids fora de ordem de propósito: a página tem de seguir a ordem do banco, não a da inserção. */
const linhas = (total: number): WorkflowQueryRow[] =>
  Array.from({ length: total }, (_, index) => {
    const n = (index * 7919) % total;
    return {
      id: `d${String(n).padStart(4, '0')}`,
      data: { nome: `Pessoa ${n}`, lote: n % 3 === 0 ? 'B' : 'A', valor: n, responsavel: n % 2 === 0 ? 'ana' : 'bia' },
    };
  });

/** O banco no que importa aqui: igualdade e, com `page`, a ordem do id a partir do cursor. */
class PagedQueryRepository implements IWorkflowQueryRepository {
  calls: { filters: WorkflowEqualityFilter[]; page?: WorkflowQueryPage }[] = [];
  constructor(private readonly rows: Record<string, WorkflowQueryRow[]>) {}
  async queryByEquality(
    _tenantId: string,
    collection: string,
    filters: WorkflowEqualityFilter[],
    limit: number,
    page?: WorkflowQueryPage,
  ): Promise<WorkflowQueryRow[]> {
    this.calls.push({ filters, page });
    const matching = (this.rows[collection] ?? []).filter((row) => filters.every((filter) =>
      filter.op === 'array-contains'
        ? Array.isArray(row.data[filter.path]) && (row.data[filter.path] as unknown[]).includes(filter.value)
        : row.data[filter.path] === filter.value));
    const ordered = page ? [...matching].sort((left, right) => compareDocumentIds(left.id, right.id)) : matching;
    const after = page?.after;
    return ordered.filter((row) => after === undefined || compareDocumentIds(row.id, after) > 0).slice(0, limit);
  }
}

class Fetcher implements IWorkflowRecordFetcher {
  constructor(private readonly rows: Record<string, WorkflowQueryRow[]>) {}
  async fetchByIds(_tenantId: string, collection: string, ids: string[]) {
    const all = this.rows[collection] ?? [];
    return new Map(ids.map((id) => [id, all.find((row) => row.id === id)?.data ?? null]));
  }
}

const spec = (overrides: Partial<QuerySpec>): QuerySpec => ({
  table: 'destinatarios',
  where: [],
  limit: 50,
  projections: [],
  ...overrides,
});

const consultar = (
  db: Record<string, WorkflowQueryRow[]>,
  querySpec: QuerySpec,
  values: unknown[],
  pageAfter: unknown,
  limits: WorkflowQueryLimits,
  repo = new PagedQueryRepository(db),
) => runRecordQuery(
  querySpec,
  values,
  { tenantId: 't1' },
  { queryRepository: repo, fetcher: new Fetcher(db), screenProvider },
  limits,
  { pageAfter },
);

const valor = async (promise: ReturnType<typeof consultar>): Promise<WorkflowQueryResult> => {
  const outcome = await promise;
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.value;
};

/** Percorre a coleção inteira como uma automação faria, execução após execução. */
const percorrer = async (
  db: Record<string, WorkflowQueryRow[]>,
  querySpec: QuerySpec,
  values: unknown[],
  limits: WorkflowQueryLimits,
): Promise<{ ids: string[]; pages: number }> => {
  const ids: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page = await valor(consultar(db, querySpec, values, cursor, limits));
    expect(page.count).toBeLessThanOrEqual(Math.min(querySpec.limit, limits.maxResults));
    ids.push(...page.results.map((record) => String(record.id)));
    cursor = page.cursor;
    pages += 1;
    expect(pages).toBeLessThan(1000);
  } while (cursor !== null);
  return { ids, pages };
};

const sorted = (ids: string[]): string[] => [...ids].sort(compareDocumentIds);

describe('consulta em páginas', () => {
  const db = { destinatarios: linhas(650) };
  const limits = { maxScan: 300, maxResults: 100 };

  it('percorre uma coleção maior que os tetos entregando cada registro uma única vez, na ordem do id', async () => {
    const { ids, pages } = await percorrer(db, spec({ limit: 100, page: {} }), [], limits);
    expect(ids).toHaveLength(650);
    expect(new Set(ids).size).toBe(650);
    expect(ids).toEqual(sorted(ids));
    expect(pages).toBe(7);
  });

  it('com filtro em memória, não perde o que atende depois do corte do limit nem o que está além da varredura', async () => {
    const foraDoB = spec({ limit: 40, page: {}, where: [{ path: 'lote', op: 'neq', value: { kind: 'Literal', value: 'B' } }] });
    const atende = db.destinatarios.filter((row) => row.data.lote !== 'B').map((row) => row.id);
    const { ids } = await percorrer(db, foraDoB, ['B'], limits);
    expect(ids).toEqual(sorted(atende));
  });

  it('a igualdade continua descendo ao banco, junto da ordem do id e do cursor', async () => {
    const repo = new PagedQueryRepository(db);
    const loteB = spec({ limit: 100, page: {}, where: [{ path: 'lote', op: 'eq', value: { kind: 'Literal', value: 'B' } }] });
    const primeira = await valor(consultar(db, loteB, ['B'], null, limits, repo));
    expect(repo.calls[0]).toEqual({ filters: [{ path: 'lote', value: 'B' }], page: { after: undefined } });

    await valor(consultar(db, loteB, ['B'], primeira.cursor, limits, repo));
    expect(repo.calls[1]).toEqual({ filters: [{ path: 'lote', value: 'B' }], page: { after: primeira.cursor } });

    const todos = await percorrer(db, loteB, ['B'], limits);
    expect(todos.ids).toEqual(sorted(db.destinatarios.filter((row) => row.data.lote === 'B').map((row) => row.id)));
  });

  it('o cursor da página cortada pelo limit é o último registro entregue', async () => {
    const page = await valor(consultar(db, spec({ limit: 10, page: {} }), [], null, limits));
    expect(page.count).toBe(10);
    expect(page.hasMore).toBe(true);
    expect(page.cursor).toBe(page.results[9].id);
  });

  it('a última página publica cursor nulo', async () => {
    const pequeno = { destinatarios: linhas(5) };
    const page = await valor(consultar(pequeno, spec({ limit: 10, page: {} }), [], null, limits));
    expect(page.count).toBe(5);
    expect(page.cursor).toBeNull();
    expect(page.hasMore).toBe(false);
  });

  it('a varredura que esgota sem nada que atenda ainda avança — o cursor é o último registro varrido', async () => {
    const nenhum = spec({ limit: 10, page: {}, where: [{ path: 'valor', op: 'lt', value: { kind: 'Literal', value: 0 } }] });
    const page = await valor(consultar(db, nenhum, [0], null, limits));
    expect(page.count).toBe(0);
    expect(page.cursor).toBe(sorted(db.destinatarios.map((row) => row.id))[299]);
    expect((await percorrer(db, nenhum, [0], limits)).pages).toBe(3);
  });

  it('a busca por id também pagina, na mesma ordem', async () => {
    const ids = ['d0042', 'd0007', 'd0600', 'd0001', 'd0300'];
    const porId = spec({ limit: 2, page: {}, where: [{ path: 'id', op: 'in', value: { kind: 'Literal', value: ids } }] });
    const { ids: lidos } = await percorrer(db, porId, [ids], { maxScan: 3, maxResults: 100 });
    expect(lidos).toEqual(sorted(ids));
  });

  it('a varredura de quem a visibilidade restringe pagina sem pular registro de nenhuma das consultas', async () => {
    const dbRestrito = {
      restritos: linhas(90).map((row, index) => ({
        ...row,
        data: { ...row.data, responsavel: index % 4 === 0 ? ['ana', 'caio'] : row.data.responsavel },
      })),
    };
    const visiveis = dbRestrito.restritos
      .filter((row) => row.data.responsavel === 'ana' || (Array.isArray(row.data.responsavel) && row.data.responsavel.includes('ana')))
      .map((row) => row.id);

    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const outcome = await runRecordQuery(
        spec({ table: 'restritos', limit: 100, page: {} }),
        [],
        { tenantId: 't1', reader: { uid: 'ana', permissions: [] } },
        { queryRepository: new PagedQueryRepository(dbRestrito), fetcher: new Fetcher(dbRestrito), screenProvider },
        { maxScan: 7, maxResults: 100 },
        { pageAfter: cursor },
      );
      if (!outcome.ok) throw new Error(outcome.error);
      ids.push(...outcome.value.results.map((record) => String(record.id)));
      cursor = outcome.value.cursor;
    } while (cursor !== null);

    expect(ids).toEqual(sorted(visiveis));
  });

  it('recusa a ordenação declarada junto da página', async () => {
    const outcome = await consultar(db, spec({ page: {}, orderBy: [{ path: 'valor', dir: 'desc' }] }), [], null, limits);
    expect(outcome).toMatchObject({ ok: false, error: '@core.automation/query.invalid' });
    expect(!outcome.ok && outcome.errorParams?.detail).toMatch(/query\.page\.order-by/);
  });

  it('recusa um cursor que não é texto, em vez de recomeçar do início', async () => {
    const outcome = await consultar(db, spec({ page: {} }), [], 42, limits);
    expect(outcome).toEqual({ ok: false, error: '@core.automation/query.page.cursor-invalid', errorParams: { cursor: '42' } });
  });
});

describe('consulta sem página — o comportamento de sempre', () => {
  const db = { destinatarios: linhas(650) };

  it('um limit acima do teto continua devolvendo o teto, agora dizendo que ficou algo de fora', async () => {
    const repo = new PagedQueryRepository(db);
    const page = await valor(consultar(db, spec({ limit: 300 }), [], undefined, { maxScan: 300, maxResults: 100 }, repo));
    expect(page.count).toBe(100);
    expect(page.hasMore).toBe(true);
    expect(page.cursor).toBeNull();
    expect(repo.calls[0].page).toBeUndefined();
  });

  it('quando tudo coube, hasMore é falso', async () => {
    const pequeno = { destinatarios: linhas(5) };
    const page = await valor(consultar(pequeno, spec({ limit: 10 }), [], undefined, { maxScan: 300, maxResults: 100 }));
    expect(page).toMatchObject({ count: 5, hasMore: false, cursor: null, complete: true });
  });
});

describe('passo "Buscar Registros"', () => {
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  const context = (payload: Record<string, unknown>): WorkflowContext => ({
    event: { id: 'e1', tenantId: 't1', name: 'workflow.called', payload, timestamp: new Date() } as WorkflowEvent,
    outputs: {},
    variables: {},
    services: { logger, now: () => new Date() },
    logger,
    execution: { id: 'x1', workflowDefinitionId: 'w1', tenantId: 't1' },
  });
  const db = { destinatarios: linhas(650) };
  const executar = (query: QuerySpec, payload: Record<string, unknown> = {}) =>
    makeQueryStepDefinition(new PagedQueryRepository(db), new Fetcher(db), screenProvider)
      .createExecutor()
      .execute({ query }, context(payload));

  it('publica cursor e hasMore, e lê o cursor de um mapeamento — execução após execução', async () => {
    const query = spec({ limit: 100, page: { after: { kind: 'Expression', expression: 'event.cursor' } } });
    const vistos: string[] = [];
    let cursor: unknown = null;
    let execucoes = 0;
    do {
      const result = await executar(query, { cursor });
      expect(result.success).toBe(true);
      vistos.push(...(result.outputs?.results as Record<string, unknown>[]).map((record) => String(record.id)));
      cursor = result.outputs?.cursor;
      expect(result.outputs?.hasMore).toBe(cursor !== null);
      expect(result.message).toBe(cursor === null ? '@core.automation/step.query.found' : '@core.automation/step.query.found-page');
      execucoes += 1;
    } while (cursor !== null);
    expect(execucoes).toBe(7);
    expect(new Set(vistos).size).toBe(650);
  });

  it('sem página, o histórico diz quando a consulta chegou ao teto', async () => {
    const result = await executar(spec({ limit: 300 }));
    expect(result.outputs?.count).toBe(QUERY_MAX_RESULTS);
    expect(result.outputs?.cursor).toBeNull();
    expect(result.outputs?.hasMore).toBe(true);
    expect(result.message).toBe('@core.automation/step.query.found-partial');
  });
});
