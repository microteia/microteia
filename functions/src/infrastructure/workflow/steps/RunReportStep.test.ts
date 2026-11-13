import { describe, it, expect } from 'vitest';
import type {
  IWorkflowQueryRepository,
  WorkflowEqualityFilter,
  WorkflowQueryRow,
} from '../../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../../domain/repositories/IWorkflowRecordFetcher';
import type { IReportDefinitionReader, StoredReport } from '../../../domain/repositories/IReportDefinitionReader';
import type { SchemaScreen } from '../../../domain/schema/pathResolver';
import { fakeScreenProvider } from '../../../domain/repositories/fakeScreenProvider';
import type { WorkflowContext, WorkflowLogger } from '../../../domain/entities/WorkflowContext';
import type { InputMapping } from '../../../domain/entities/Workflow';
import type { ReportSpec } from '../../../domain/schema/report/reportSpec';
import { makeRunReportStepDefinition } from './RunReportStep';
import type { RunReportFileDeps } from './RunReportStep';
import type { DownloadFileInput } from '../../../domain/repositories/IDownloadWriter';
import { buildMessageCatalog } from '../../../domain/schema/i18n/messages';
import type { IReportSnapshotRepository } from '../../../domain/repositories/IReportSnapshotRepository';
import { reportSnapshotDefinition } from '../../../domain/schema/report/reportSnapshot';
import type { ReportSnapshot } from '../../../domain/schema/report/reportSnapshot';

const lancamentos: SchemaScreen = {
  id: 'lancamentos',
  titleSingular: 'Lançamento',
  titleFieldKey: 'titulo',
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', required: false, order: 0, origin: 'design' },
    { key: 'situacao', label: 'Situação', type: 'text', required: false, order: 1, origin: 'design' },
    { key: 'valor', label: 'Valor', type: 'currency', required: false, order: 2, origin: 'design' },
  ],
};

class FakeQueryRepository implements IWorkflowQueryRepository {
  constructor(private readonly rows: WorkflowQueryRow[]) {}
  async queryByEquality(_tenantId: string, _collection: string, filters: WorkflowEqualityFilter[]) {
    return this.rows.filter((row) => filters.every((filter) => row.data[filter.path] === filter.value));
  }
}

class FakeFetcher implements IWorkflowRecordFetcher {
  async fetchByIds(_tenantId: string, _collection: string, ids: string[]) {
    return new Map(ids.map((id) => [id, null]));
  }
}

const spec: ReportSpec = {
  v: 1,
  dataset: {
    table: 'lancamentos',
    dimensions: [{ key: 'situacao', path: 'situacao' }],
    measures: [{ key: 'total', op: 'sum', path: 'valor' }],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'situacao' }], values: ['total'] },
  presentation: {
    prompts: [{ key: 'situacao', path: 'situacao', op: 'eq' }],
  },
};

const rows: WorkflowQueryRow[] = [
  { id: '1', data: { situacao: 'pago', valor: 100 } },
  { id: '2', data: { situacao: 'pago', valor: 200 } },
  { id: '3', data: { situacao: 'aberto', valor: 50 } },
];

const reader = (reports: StoredReport[]): IReportDefinitionReader => ({
  find: async (_tenantId, keyOrId) =>
    reports.find((report) => report.key === keyOrId || report.id === keyOrId) ?? null,
});

const warnings: string[] = [];
const logger: WorkflowLogger = { info: () => {}, warn: (message) => warnings.push(message), error: () => {} };

const context = (stepConfiguration: Record<string, InputMapping> = {}): WorkflowContext => ({
  event: { id: 'ev', tenantId: 't1', name: 'schedule', payload: {}, timestamp: new Date() },
  outputs: {},
  variables: {},
  services: { logger, now: () => new Date('2026-05-05T12:00:00.000Z') },
  logger,
  execution: { id: 'e1', workflowDefinitionId: 'w1', tenantId: 't1' },
  input: {},
  stepConfiguration,
});

const step = (reports: StoredReport[] = [{ id: 'doc1', key: 'receita', title: 'Receita', spec }]) =>
  makeRunReportStepDefinition({
    reports: reader(reports),
    query: {
      queryRepository: new FakeQueryRepository(rows),
      fetcher: new FakeFetcher(),
      screenProvider: fakeScreenProvider([lancamentos]),
    },
  }).createExecutor();

describe('passo run-report', () => {
  it('publica o total, os totais por medida e uma linha por grupo', async () => {
    const result = await step().execute({ report: 'receita' }, context());

    expect(result.success).toBe(true);
    expect(result.message).toBe('@core.automation/step.run-report.done');
    expect(result.outputs).toMatchObject({
      total: 350,
      totals: { total: 350 },
      count: 3,
      groups: 2,
      complete: true,
      rowsTruncated: false,
      name: 'Receita',
      // A chave, e não o id do documento: é o endereço que sobrevive a reinstalar a extensão dona.
      link: 'rep:receita',
    });
    expect(result.outputs?.rows).toEqual(expect.arrayContaining([
      { situacao: 'pago', total: 300, count: 2 },
      { situacao: 'aberto', total: 50, count: 1 },
    ]));
  });

  it('acha o relatório também pelo id do documento', async () => {
    const result = await step().execute({ report: 'doc1' }, context());
    expect(result.outputs?.link).toBe('rep:receita');
  });

  it('responde os filtros: o param.<chave> vence o bloco', async () => {
    const result = await step().execute(
      { report: 'receita', prompts: { situacao: 'aberto' } },
      context({ 'param.situacao': { kind: 'Literal', value: 'pago' } }),
    );

    expect(result.outputs).toMatchObject({ total: 300, count: 2, groups: 1 });
  });

  it('o param vazio não apaga a resposta do bloco nem o padrão do relatório', async () => {
    // O campo que ninguém preencheu no editor não é "sem restrição": é "sem resposta".
    const result = await step().execute(
      { report: 'receita', prompts: { situacao: 'aberto' } },
      context({ 'param.situacao': { kind: 'Literal', value: '' } }),
    );

    expect(result.outputs).toMatchObject({ total: 50, count: 1 });
  });

  it('reprova o relatório que não existe, em vez de publicar zero', async () => {
    const result = await step().execute({ report: 'sumiu' }, context());

    expect(result.success).toBe(false);
    expect(result.message).toBe('@core.reports/handler.not-found');
    expect(result.messageParams).toEqual({ id: 'sumiu' });
  });

  it('reprova o filtro obrigatório sem resposta', async () => {
    // Um alerta que segue com total zero diria "está tudo bem" justamente quando não se sabe.
    const obrigatorio: ReportSpec = {
      ...spec,
      presentation: { prompts: [{ key: 'situacao', path: 'situacao', op: 'eq', required: true }] },
    };
    const result = await step([{ id: 'doc1', key: 'receita', title: 'Receita', spec: obrigatorio }])
      .execute({ report: 'receita' }, context());

    expect(result.success).toBe(false);
    expect(result.message).toBe('@core.reports/prompt.required.missing');
  });

  it('pede o relatório quando o passo não o escolheu', async () => {
    const result = await step().execute({}, context());
    expect(result.message).toBe('@core.automation/step.run-report.not-configured');
  });
});

describe('passo run-report — o arquivo em Downloads', () => {
  const saved: DownloadFileInput[] = [];
  const fileDeps: RunReportFileDeps = {
    sources: { getRecords: async () => new Map(), getLookupOptions: async () => [] },
    catalog: async () => buildMessageCatalog([{ locale: 'en', namespace: 'core.reports', messages: { 'table.total': 'Total' } }], 'en'),
    localeOf: async () => 'en',
    downloads: {
      save: async (file) => {
        saved.push(file);
        return { id: 'd1', name: file.name, url: 'https://files/d1', storagePath: 'x', contentType: file.contentType, size: file.data.length, expiresAt: file.expiresAt };
      },
    },
    downloadPolicyOf: async () => ({ retentionDays: 7, automationVisibility: 'managers' }),
    renderPdf: async () => Buffer.from('%PDF-fake'),
  };
  const withFile = () => makeRunReportStepDefinition({
    reports: reader([{ id: 'doc1', key: 'receita', title: 'Receita', spec }]),
    query: { queryRepository: new FakeQueryRepository(rows), fetcher: new FakeFetcher(), screenProvider: fakeScreenProvider([lancamentos]) },
    file: fileDeps,
  }).createExecutor();

  it('grava o XLSX com a visibilidade de arquivo de automação e publica o nome e o endereço', async () => {
    const result = await withFile().execute({ report: 'receita', file: 'xlsx' }, context());

    expect(result.success).toBe(true);
    expect(saved[0]).toMatchObject({
      name: 'receita-2026-05-05.xlsx',
      ownerId: null,
      visibility: 'managers',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(result.outputs).toMatchObject({ fileId: 'd1', fileName: 'receita-2026-05-05.xlsx', fileUrl: 'https://files/d1' });
    expect(result.outputs?.table).toMatchObject({ header: ['situacao', 'total'], totals: ['Total', '350'] });
  });

  it('o PDF vai pelo renderizador do motor de Documentos', async () => {
    const result = await withFile().execute({ report: 'receita', file: 'pdf' }, context());
    expect(result.outputs?.fileName).toBe('receita-2026-05-05.pdf');
    expect(saved.at(-1)?.data.toString()).toBe('%PDF-fake');
  });

  it('formato que não existe reprova; sem as dependências de arquivo, pedir arquivo também', async () => {
    expect((await withFile().execute({ report: 'receita', file: 'docx' }, context())).message)
      .toBe('@core.automation/step.run-report.file-unsupported');
    expect((await step().execute({ report: 'receita', file: 'xlsx' }, context())).message)
      .toBe('@core.automation/step.run-report.file-unavailable');
  });
});


describe('passo run-report — o instantâneo para a série', () => {
  const saved: { tenantId: string; snapshot: Omit<ReportSnapshot, 'id'> }[] = [];
  const snapshots: IReportSnapshotRepository = {
    save: async (tenantId, snapshot) => { saved.push({ tenantId, snapshot }); return 'snap1'; },
    series: async () => [],
  };
  const withSnapshots = (reports: StoredReport[] = [{ id: 'doc1', key: 'receita', title: 'Receita', spec }]) =>
    makeRunReportStepDefinition({
      reports: reader(reports),
      query: { queryRepository: new FakeQueryRepository(rows), fetcher: new FakeFetcher(), screenProvider: fakeScreenProvider([lancamentos]) },
      snapshots,
    }).createExecutor();

  it('guarda os grupos, os totais e a definição, com a data e a validade, e publica o id da foto', async () => {
    saved.length = 0;
    const result = await withSnapshots().execute({ report: 'receita', snapshot: true }, context());
    expect(result).toMatchObject({ success: true, outputs: { snapshotId: 'snap1', total: 350 } });
    expect(saved).toHaveLength(1);
    expect(saved[0].tenantId).toBe('t1');
    expect(saved[0].snapshot).toMatchObject({
      report: 'receita',
      takenAt: new Date('2026-05-05T12:00:00.000Z'),
      expiresAt: new Date('2031-05-05T12:00:00.000Z'),
      rows: [{ situacao: 'aberto', total: 50, count: 1 }, { situacao: 'pago', total: 300, count: 2 }],
      totals: { total: 350 },
      count: 3,
      complete: true,
      truncated: false,
      takenBy: null,
      definition: reportSnapshotDefinition(spec),
    });
  });

  it('sem pedir, não guarda nada', async () => {
    saved.length = 0;
    const result = await withSnapshots().execute({ report: 'receita' }, context());
    expect(result.success).toBe(true);
    expect(saved).toHaveLength(0);
  });

  it('recusa a lista simples, e recusa sem onde guardar — antes de executar o relatório', async () => {
    saved.length = 0;
    const lista: ReportSpec = { ...spec, shape: { kind: 'tabular', columns: ['situacao'] } };
    const tabular = await withSnapshots([{ id: 'd', key: 'lista', title: 'Lista', spec: lista }]).execute({ report: 'lista', snapshot: true }, context());
    expect(tabular).toMatchObject({ success: false, message: '@core.reports/snapshot.tabular' });
    const semRepositorio = await step().execute({ report: 'receita', snapshot: true }, context());
    expect(semRepositorio).toMatchObject({ success: false, message: '@core.reports/snapshot.unavailable' });
    expect(saved).toHaveLength(0);
  });
});
