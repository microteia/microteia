import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HttpsError } from 'firebase-functions/v2/https';
import type {
  IWorkflowQueryRepository,
  WorkflowEqualityFilter,
  WorkflowQueryRow,
} from '../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../domain/repositories/IWorkflowRecordFetcher';
import type { SchemaScreen } from '../../domain/schema/pathResolver';
import { fakeScreenProvider } from '../../domain/repositories/fakeScreenProvider';
import type { WorkflowContext, WorkflowLogger } from '../../domain/entities/WorkflowContext';
import type { ReportSpec } from '../../domain/schema/report/reportSpec';
import { requireReportCollections, runReportQuery } from './runReportQuery';
import { REPORT_MAX_SCAN } from './reportLimits';

const permissionsByUser: Record<string, string[]> = {};

vi.mock('../di/container', () => ({
  getDI: () => ({
    getTenantMemberRepository: () => ({
      getMemberPermissions: async (_tenantId: string, userId: string) => permissionsByUser[userId] ?? [],
    }),
    getUserRepository: () => ({ getUserRole: async () => null }),
    getTenantRepository: () => ({ getById: async () => null }),
  }),
}));

const personsScreen: SchemaScreen = {
  id: 'clientes',
  titleSingular: 'Cliente',
  titleFieldKey: 'nome',
  fields: [
    { key: 'nome', label: 'Nome', type: 'text', required: false, order: 0, origin: 'design' },
    { key: 'cidade', label: 'Cidade', type: 'text', required: false, order: 1, origin: 'design' },
  ],
};

const lancamentosScreen: SchemaScreen = {
  id: 'lancamentos',
  titleSingular: 'Lançamento',
  titleFieldKey: 'titulo',
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', required: false, order: 0, origin: 'design' },
    { key: 'situacao', label: 'Situação', type: 'text', required: false, order: 1, origin: 'design' },
    { key: 'valor', label: 'Valor', type: 'currency', required: false, order: 2, origin: 'design' },
    {
      key: 'clienteId', label: 'Cliente', type: 'reference', refEntity: 'clientes',
      refDenormKey: 'cliente', required: false, order: 3, origin: 'design',
    },
  ],
};

class FakeQueryRepository implements IWorkflowQueryRepository {
  calls: { collection: string; filters: WorkflowEqualityFilter[]; limit: number }[] = [];
  constructor(private readonly rows: WorkflowQueryRow[]) {}
  async queryByEquality(
    _tenantId: string,
    collection: string,
    equalityFilters: WorkflowEqualityFilter[],
    limit: number,
  ): Promise<WorkflowQueryRow[]> {
    this.calls.push({ collection, filters: equalityFilters, limit });
    return this.rows;
  }
}

class FakeFetcher implements IWorkflowRecordFetcher {
  constructor(private readonly byId: Record<string, Record<string, unknown>> = {}) {}
  async fetchByIds(_tenantId: string, _collection: string, ids: string[]) {
    return new Map(ids.map((id) => [id, this.byId[id] ?? null]));
  }
}

const logger: WorkflowLogger = { info: () => {}, warn: () => {}, error: () => {} };

const context = (): WorkflowContext => ({
  event: { id: '', tenantId: 't1', name: 'report.run', payload: {}, timestamp: new Date() },
  outputs: {},
  variables: {},
  services: { logger, now: () => new Date('2026-05-05T12:00:00.000Z') },
  logger,
  execution: { id: 'e1', workflowDefinitionId: '', tenantId: 't1' },
  actor: { userId: 'ana', permissions: [] },
  input: {},
});

const deps = (rows: WorkflowQueryRow[], byId: Record<string, Record<string, unknown>> = {}) => ({
  queryRepository: new FakeQueryRepository(rows),
  fetcher: new FakeFetcher(byId),
  screenProvider: fakeScreenProvider([personsScreen, lancamentosScreen]),
});

const spec: ReportSpec = {
  v: 1,
  dataset: {
    table: 'lancamentos',
    dimensions: [{ key: 'situacao', path: 'situacao' }],
    measures: [{ key: 'total', op: 'sum', path: 'valor' }],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'situacao' }], values: ['total'] },
};

const rows: WorkflowQueryRow[] = [
  { id: '1', data: { situacao: 'pago', valor: 100, clienteId: 'c1' } },
  { id: '2', data: { situacao: 'pago', valor: 200, clienteId: 'c2' } },
  { id: '3', data: { situacao: 'aberto', valor: 50, clienteId: 'c1' } },
];

const denied = async (promise: Promise<unknown>): Promise<HttpsError> => {
  try {
    await promise;
  } catch (error) {
    return error as HttpsError;
  }
  throw new Error('esperava recusa, e a chamada passou');
};

beforeEach(() => {
  for (const key of Object.keys(permissionsByUser)) delete permissionsByUser[key];
});

describe('requireReportCollections — o RBAC no servidor', () => {
  const schema = () => fakeScreenProvider([personsScreen, lancamentosScreen]).getSchemaContext('t1');

  it('exige a leitura da coleção-fonte', async () => {
    // Um agregado sobre linhas que o leitor não pode ver é como um relatório vaza dado: a contagem
    // de salários acima de X não mostra nenhum salário e revela todos.
    const error = await denied(requireReportCollections(spec, await schema(), 't1', 'ana'));

    expect(error.code).toBe('permission-denied');
  });

  it('passa quando a leitura da fonte foi concedida', async () => {
    permissionsByUser.ana = ['lancamentos.read'];

    await expect(requireReportCollections(spec, await schema(), 't1', 'ana')).resolves.toBeUndefined();
  });

  it('exige TAMBÉM a leitura da coleção alcançada por referência', async () => {
    // A maior brecha do desenho: agrupar por `cliente.cidade` LÊ a coleção de clientes. Quem pode
    // ver Lançamentos e não pode abrir Clientes não pode receber um campo de Clientes por aqui.
    permissionsByUser.ana = ['lancamentos.read'];
    const comHop: ReportSpec = {
      ...spec,
      dataset: { ...spec.dataset, dimensions: [{ key: 'cidade', path: 'cliente.cidade' }] },
      shape: { kind: 'summary', groupBy: [{ dimension: 'cidade' }], values: ['total'] },
    };

    const error = await denied(requireReportCollections(comHop, await schema(), 't1', 'ana'));
    expect(error.code).toBe('permission-denied');

    permissionsByUser.ana = ['lancamentos.read', 'clientes.read'];
    await expect(requireReportCollections(comHop, await schema(), 't1', 'ana')).resolves.toBeUndefined();
  });
});

describe('runReportQuery', () => {
  it('agrega as linhas varridas', async () => {
    const outcome = await runReportQuery({ spec, context: context(), deps: deps(rows) });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.rows.map((row) => [row.keys[0].key, row.values.total]))
      .toEqual([['aberto', 50], ['pago', 300]]);
    expect(outcome.value.totals).toEqual({ values: { total: 350 }, count: 3 });
  });

  it('varre com o teto do RELATÓRIO, não com o do fluxo', async () => {
    const d = deps(rows);
    await runReportQuery({ spec, context: context(), deps: d });

    expect((d.queryRepository as FakeQueryRepository).calls[0].limit).toBe(REPORT_MAX_SCAN);
  });

  it('diz que o resultado é COMPLETO quando a varredura não bateu no teto', async () => {
    const outcome = await runReportQuery({ spec, context: context(), deps: deps(rows) });

    expect(outcome.ok && outcome.value.complete).toBe(true);
    expect(outcome.ok && outcome.value.scanned).toBe(3);
  });

  it('admite a varredura PARCIAL — um relatório que mente é pior que um que não existe', async () => {
    // Quando a varredura bate no teto, o número exibido cobre só o que foi visto. `complete: false`
    // sobe até a tela, o cabeçalho do CSV e o rodapé da impressão: é a única falha deste desenho que
    // o leitor não teria como notar sozinho.
    const cheias = Array.from({ length: REPORT_MAX_SCAN }, (_, index) => ({
      id: String(index),
      data: { situacao: 'pago', valor: 1 },
    }));

    const outcome = await runReportQuery({ spec, context: context(), deps: deps(cheias) });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.complete).toBe(false);
    expect(outcome.value.scanned).toBe(REPORT_MAX_SCAN);
    expect(outcome.value.totals?.values.total).toBe(REPORT_MAX_SCAN);
  });

  it('recusa nomeando o problema quando o spec não vale', async () => {
    const quebrado: ReportSpec = {
      ...spec,
      shape: { kind: 'summary', groupBy: [{ dimension: 'inexistente' }], values: ['total'] },
    };

    const outcome = await runReportQuery({ spec: quebrado, context: context(), deps: deps(rows) });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toBe('@core.reports/spec.invalid');
    expect(outcome.errorParams?.detail).toContain('@core.reports/shape.dimension.unknown');
  });

  it('devolve os AVISOS junto com o resultado — degradação não é recusa', async () => {
    const comAviso: ReportSpec = {
      ...spec,
      presentation: { chart: { kind: 'bar', category: 'nao-existe' } },
    };

    const outcome = await runReportQuery({ spec: comAviso, context: context(), deps: deps(rows) });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.issues.map((issue) => issue.error)).toContain('@core.reports/chart.key.unknown');
  });

  it('o filtro que o LEITOR preencheu entra como igualdade no servidor', async () => {
    const comPrompt: ReportSpec = {
      ...spec,
      presentation: { prompts: [{ key: 'situacao', path: 'situacao', op: 'eq' }] },
    };
    const d = deps(rows);

    await runReportQuery({ spec: comPrompt, context: context(), deps: d, prompts: { situacao: 'pago' } });

    expect((d.queryRepository as FakeQueryRepository).calls[0].filters)
      .toEqual([{ path: 'situacao', value: 'pago' }]);
  });

  it('filtro sem valor preenchido não vira predicado', async () => {
    const comPrompt: ReportSpec = {
      ...spec,
      presentation: { prompts: [{ key: 'situacao', path: 'situacao', op: 'eq' }] },
    };
    const d = deps(rows);

    await runReportQuery({ spec: comPrompt, context: context(), deps: d, prompts: { situacao: '' } });

    expect((d.queryRepository as FakeQueryRepository).calls[0].filters).toEqual([]);
  });

  it('resolve o filtro de uma MEDIDA e o aplica só a ela', async () => {
    const comMedidaFiltrada: ReportSpec = {
      ...spec,
      dataset: {
        ...spec.dataset,
        measures: [
          { key: 'total', op: 'sum', path: 'valor' },
          {
            key: 'pagas', op: 'sum', path: 'valor',
            filter: [{ path: 'situacao', op: 'eq', value: { kind: 'Literal', value: 'pago' } }],
          },
        ],
      },
      shape: { kind: 'summary', groupBy: [{ dimension: 'situacao' }], values: ['total', 'pagas'] },
    };

    const outcome = await runReportQuery({ spec: comMedidaFiltrada, context: context(), deps: deps(rows) });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.totals).toEqual({ values: { total: 350, pagas: 300 }, count: 3 });
  });

  it('agrupa por campo de coleção relacionada, hidratando a referência', async () => {
    const comHop: ReportSpec = {
      ...spec,
      dataset: { ...spec.dataset, dimensions: [{ key: 'cidade', path: 'cliente.cidade' }] },
      shape: { kind: 'summary', groupBy: [{ dimension: 'cidade' }], values: ['total'] },
    };

    const outcome = await runReportQuery({
      spec: comHop,
      context: context(),
      deps: deps(rows, { c1: { cidade: 'Recife' }, c2: { cidade: 'Olinda' } }),
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.rows.map((row) => [row.keys[0].key, row.values.total]))
      .toEqual([['Olinda', 200], ['Recife', 150]]);
  });
});
