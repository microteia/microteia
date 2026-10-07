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
import { requireReportAccess, runReportQuery } from './runReportQuery';
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
    { key: 'email', label: 'E-mail', type: 'text', required: false, order: 2, origin: 'design' },
  ],
};

const processosScreen: SchemaScreen = {
  id: 'processos',
  titleSingular: 'Processo',
  titleFieldKey: 'titulo',
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', required: false, order: 0, origin: 'design' },
    {
      key: 'poloAtivoIds', label: 'Polo ativo', type: 'reference', refEntity: 'clientes',
      multi: true, required: false, order: 1, origin: 'design',
    },
    {
      key: 'responsavelId', label: 'Responsável', type: 'reference', refEntity: 'clientes',
      required: false, order: 2, origin: 'design',
    },
    {
      key: 'etiquetas', label: 'Etiquetas', type: 'select', multi: true,
      required: false, order: 3, origin: 'design',
    },
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

/**
 * O banco, no que ele faz de diferente: a igualdade que DESCE é resolvida por ele, e o que sobra
 * chega inteiro à memória. Um dublê que devolvesse tudo esconderia justamente a decisão que o motor
 * de consulta toma.
 */
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
    return this.rows.filter((row) => equalityFilters.every((filter) => {
      const value = filter.path.split('.').reduce<unknown>(
        (current, key) => (current as Record<string, unknown> | undefined)?.[key],
        row.data,
      );
      return value === filter.value;
    }));
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
  screenProvider: fakeScreenProvider([personsScreen, lancamentosScreen, processosScreen]),
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

describe('requireReportAccess — o RBAC no servidor', () => {
  const schema = () => fakeScreenProvider([personsScreen, lancamentosScreen]).getSchemaContext('t1');

  it('exige a leitura da coleção-fonte', async () => {
    // Um agregado sobre linhas que o leitor não pode ver é como um relatório vaza dado: a contagem
    // de salários acima de X não mostra nenhum salário e revela todos.
    const error = await denied(requireReportAccess(spec, await schema(), 't1', 'ana'));

    expect(error.code).toBe('permission-denied');
  });

  it('passa quando a leitura da fonte foi concedida', async () => {
    permissionsByUser.ana = ['lancamentos.read'];

    // Devolve o conjunto CONCEDIDO, e não `void`: é ele que o `hasPermission` de um filtro por
    // expressão consulta, e uma segunda leitura do mesmo documento de membro seria desperdício.
    await expect(requireReportAccess(spec, await schema(), 't1', 'ana'))
      .resolves.toEqual(['lancamentos.read']);
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

    const error = await denied(requireReportAccess(comHop, await schema(), 't1', 'ana'));
    expect(error.code).toBe('permission-denied');

    permissionsByUser.ana = ['lancamentos.read', 'clientes.read'];
    await expect(requireReportAccess(comHop, await schema(), 't1', 'ana'))
      .resolves.toEqual(['lancamentos.read', 'clientes.read']);
  });

  // O guia de autoria promete que a permissão PRÓPRIA só restringe — e a callable não a cobrava: quem
  // lia a coleção via o relatório que o escritório declarou restrito.
  it('exige a permissão PRÓPRIA do relatório, além da leitura das coleções', async () => {
    permissionsByUser.ana = ['lancamentos.read'];
    const restrito: ReportSpec = { ...spec, access: { permission: 'lancamentos.margem' } };

    const error = await denied(requireReportAccess(restrito, await schema(), 't1', 'ana'));
    expect(error.code).toBe('permission-denied');

    permissionsByUser.ana = ['lancamentos.read', 'lancamentos.margem'];
    await expect(requireReportAccess(restrito, await schema(), 't1', 'ana')).resolves.toBeDefined();
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

  /**
   * O filtro sobre uma REFERÊNCIA não achava nada — nem o de um, nem o de vários.
   *
   * A linha é hidratada ANTES de o predicado ser avaliado: onde o documento guarda o id, ela traz o
   * registro apontado inteiro, e a comparação era entre esse objeto e o id que o filtro trouxe. O
   * relatório não errava o número: voltava vazio, que se lê como "não há nada assim".
   */
  describe('filtro sobre referência', () => {
    const processos: WorkflowQueryRow[] = [
      { id: '1', data: { titulo: 'A', poloAtivoIds: ['c1', 'c2'], responsavelId: 'c1', etiquetas: ['urgente', 'civel'] } },
      { id: '2', data: { titulo: 'B', poloAtivoIds: ['c3'], responsavelId: 'c3', etiquetas: ['civel'] } },
    ];
    const clientes = { c1: { nome: 'Ana' }, c2: { nome: 'Bruno' }, c3: { nome: 'Carla' } };

    const listaDe = (where: NonNullable<ReportSpec['dataset']['where']>) => ({
      v: 1 as const,
      dataset: {
        table: 'processos',
        dimensions: [{ key: 'titulo', path: 'titulo' }],
        measures: [{ key: 'qtd', op: 'count' as const }],
        where,
      },
      shape: { kind: 'tabular' as const, columns: ['titulo'] },
    });

    const idsOf = async (where: NonNullable<ReportSpec['dataset']['where']>): Promise<string[]> => {
      const outcome = await runReportQuery({
        spec: listaDe(where),
        context: context(),
        deps: deps(processos, clientes),
      });
      if (!outcome.ok) throw new Error(outcome.error);
      return (outcome.value.records ?? []).map((record) => String(record.id));
    };

    it('acha pelo apontado numa referência de VÁRIOS', async () => {
      expect(await idsOf([{ path: 'poloAtivoIds', op: 'eq', value: { kind: 'Literal', value: 'c2' } }]))
        .toEqual(['1']);
    });

    it('acha pelo apontado numa referência de UM', async () => {
      expect(await idsOf([{ path: 'responsavelId', op: 'eq', value: { kind: 'Literal', value: 'c3' } }]))
        .toEqual(['2']);
    });

    it('com vários escolhidos, atende quem tem QUALQUER UM deles', async () => {
      expect(await idsOf([{ path: 'poloAtivoIds', op: 'eq', value: { kind: 'Literal', value: ['c2', 'c3'] } }]))
        .toEqual(['1', '2']);
    });

    it('o filtro de vários que o LEITOR não preencheu não restringe nada', async () => {
      const comPrompt: ReportSpec = {
        ...listaDe([]),
        presentation: { prompts: [{ key: 'polo', path: 'poloAtivoIds', op: 'eq' }] },
      };

      const outcome = await runReportQuery({
        spec: comPrompt,
        context: context(),
        deps: deps(processos, clientes),
        prompts: { polo: [] },
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect((outcome.value.records ?? []).map((record) => String(record.id))).toEqual(['1', '2']);
    });

    /**
     * A lista de opções é um campo de vários que o caminho alcança sem salto nenhum — e por isso ia
     * ao Firestore como igualdade, onde `==` sobre um campo de lista compara a LISTA INTEIRA. A
     * consulta voltava vazia sem erro e sem aviso, indistinguível de "ninguém atende".
     */
    /**
     * A referência TERMINAL é um campo do documento: ele guarda o id, e é a hidratação — depois, em
     * memória — que põe o registro apontado no lugar dele. Tratá-la como caminho profundo mandava
     * para dentro do teto de varredura uma pergunta que o banco responde sozinho.
     */
    it('a referência de UM com um valor desce ao Firestore, como igualdade', async () => {
      const d = deps(processos, clientes);

      await runReportQuery({
        spec: listaDe([{ path: 'responsavelId', op: 'eq', value: { kind: 'Literal', value: 'c3' } }]),
        context: context(),
        deps: d,
      });

      expect((d.queryRepository as FakeQueryRepository).calls[0].filters)
        .toEqual([{ path: 'responsavelId', value: 'c3' }]);
    });

    it('o caminho que ENTRA na coleção apontada não desce — ele não existe no documento', async () => {
      const d = deps(rows);

      await runReportQuery({
        spec: {
          ...spec,
          dataset: {
            ...spec.dataset,
            where: [{ path: 'cliente.cidade', op: 'eq', value: { kind: 'Literal', value: 'Recife' } }],
          },
        },
        context: context(),
        deps: d,
      });

      expect((d.queryRepository as FakeQueryRepository).calls[0].filters).toEqual([]);
    });

    it('a referência de VÁRIOS não desce: ali o documento guarda uma lista', async () => {
      const d = deps(processos, clientes);

      await runReportQuery({
        spec: listaDe([{ path: 'poloAtivoIds', op: 'eq', value: { kind: 'Literal', value: 'c2' } }]),
        context: context(),
        deps: d,
      });

      expect((d.queryRepository as FakeQueryRepository).calls[0].filters).toEqual([]);
    });

    it('campo de VÁRIOS raso fica em memória, e filtra por pertinência', async () => {
      const d = deps(processos, clientes);

      const outcome = await runReportQuery({
        spec: listaDe([{ path: 'etiquetas', op: 'eq', value: { kind: 'Literal', value: 'urgente' } }]),
        context: context(),
        deps: d,
      });

      expect((d.queryRepository as FakeQueryRepository).calls[0].filters).toEqual([]);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect((outcome.value.records ?? []).map((record) => String(record.id))).toEqual(['1']);
    });
  });

  /**
   * O campo de CADA apontado, numa referência de vários — como coluna e como filtro.
   *
   * Os dois caminhos são o mesmo (`poloAtivoIds.cidade`), e era o executor que os separava: o
   * resolvedor exigia a posição do item, então o relatório era RECUSADO inteiro
   * (`dataset.dimensions[n].path: path.is-list`) no instante em que a autoria escolhia o campo — e a
   * recusa aparecia mesmo com o filtro em branco, porque a validação vem antes da resposta.
   */
  describe('o campo de cada apontado', () => {
    const processos: WorkflowQueryRow[] = [
      { id: '1', data: { titulo: 'A', poloAtivoIds: ['c1', 'c2'] } },
      { id: '2', data: { titulo: 'B', poloAtivoIds: ['c3'] } },
    ];
    const clientes = {
      c1: { nome: 'Ana', cidade: 'Recife', email: 'ana.souza@exemplo.com' },
      c2: { nome: 'Bruno', cidade: 'Olinda', email: 'bruno@exemplo.com' },
      c3: { nome: 'Carla', cidade: 'Natal', email: 'carla@exemplo.com' },
    };

    const porCidadeDoPolo = (prompts?: ReportSpec['presentation']): ReportSpec => ({
      v: 1,
      dataset: {
        table: 'processos',
        dimensions: [{ key: 'cidades', path: 'poloAtivoIds.cidade' }],
        measures: [{ key: 'qtd', op: 'count' }],
      },
      shape: { kind: 'summary', groupBy: [{ dimension: 'cidades' }], values: ['qtd'] },
      ...(prompts ? { presentation: prompts } : {}),
    });

    it('agrupa pela cidade de cada apontado', async () => {
      const outcome = await runReportQuery({
        spec: porCidadeDoPolo(),
        context: context(),
        deps: deps(processos, clientes),
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.value.rows.map((row) => [row.keys[0].key, row.values.qtd]))
        .toEqual([['Natal', 1], ['Recife,Olinda', 1]]);
    });

    it('o MESMO campo como filtro do leitor não recusa o relatório, e em branco não restringe', async () => {
      const spec = porCidadeDoPolo({ prompts: [{ key: 'cidade', path: 'poloAtivoIds.cidade', op: 'eq' }] });

      const emBranco = await runReportQuery({
        spec,
        context: context(),
        deps: deps(processos, clientes),
        prompts: {},
      });

      expect(emBranco.ok).toBe(true);
      if (!emBranco.ok) return;
      expect(emBranco.value.totals?.count).toBe(2);

      const respondido = await runReportQuery({
        spec,
        context: context(),
        deps: deps(processos, clientes),
        prompts: { cidade: 'Olinda' },
      });

      expect(respondido.ok).toBe(true);
      if (!respondido.ok) return;
      // Pertinência: a linha atende porque UM dos apontados dela é de Olinda.
      expect(respondido.value.rows.map((row) => row.keys[0].key)).toEqual(['Recife,Olinda']);
    });

    it('"contém" acha pelo pedaço do texto de qualquer apontado', async () => {
      // O e-mail de cada apontado é uma lista de TEXTO, e "contém" ali era comparado por igualdade
      // exata: filtrar por "alex" não achava `alexnaldo.santos@gmail.com`, e o relatório voltava
      // vazio — indistinguível de "não há nada assim".
      const spec = porCidadeDoPolo({ prompts: [{ key: 'email', path: 'poloAtivoIds.email', op: 'contains' }] });

      const outcome = await runReportQuery({
        spec,
        context: context(),
        deps: deps(processos, clientes),
        prompts: { email: 'ANA.' },
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.value.rows.map((row) => row.keys[0].key)).toEqual(['Recife,Olinda']);
    });

    it('o filtro FIXO sobre o campo de cada apontado também filtra por pertinência', async () => {
      const spec: ReportSpec = {
        ...porCidadeDoPolo(),
        dataset: {
          ...porCidadeDoPolo().dataset,
          where: [{ path: 'poloAtivoIds.cidade', op: 'eq', value: { kind: 'Literal', value: 'Natal' } }],
        },
      };

      const outcome = await runReportQuery({
        spec,
        context: context(),
        deps: deps(processos, clientes),
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.value.rows.map((row) => row.keys[0].key)).toEqual(['Natal']);
    });
  });

  describe('o filtro por EXPRESSÃO', () => {
    const com = (includeWhen: string): ReportSpec =>
      ({ ...spec, dataset: { ...spec.dataset, includeWhen } });

    it('restringe as linhas que entram na conta, e a varredura continua dizendo quantas leu', async () => {
      const outcome = await runReportQuery({
        spec: com('valor > 100'),
        context: context(),
        deps: deps(rows),
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.value.totals).toEqual({ values: { total: 200 }, count: 1 });
      // `scanned` é da VARREDURA: o filtro restringe o que entra na conta, não quantos documentos o
      // banco entregou — e é `scanned` que responde pela incompletude.
      expect(outcome.value.scanned).toBe(3);
    });

    it('a expressão atravessa a referência, e o hop é HIDRATADO por ela', async () => {
      // O caminho da expressão entra em `reportPaths`, que é o que alimenta o plano de hidratação.
      // Sem isso, `cliente.cidade` chegaria ausente e o filtro devolveria zero linha.
      const outcome = await runReportQuery({
        spec: com('cliente.cidade == "Recife"'),
        context: context(),
        deps: deps(rows, { c1: { cidade: 'Recife' }, c2: { cidade: 'Olinda' } }),
      });

      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.value.totals).toEqual({ values: { total: 150 }, count: 2 });
    });

    it('a coleção que só a EXPRESSÃO alcança também é cobrada de quem lê', async () => {
      // A lista do RBAC é derivada de `reportPaths`: se a expressão pode ler a cidade do cliente, ela
      // exige a leitura de Clientes como qualquer agrupamento exigiria.
      const schema = await fakeScreenProvider([personsScreen, lancamentosScreen]).getSchemaContext('t1');
      permissionsByUser.ana = ['lancamentos.read'];

      const error = await denied(
        requireReportAccess(com('cliente.cidade == "Recife"'), schema, 't1', 'ana'),
      );
      expect(error.code).toBe('permission-denied');
    });

    it('recusa nomeando quando a expressão não pode ser respondida', async () => {
      const outcome = await runReportQuery({
        spec: com('getVar("x") == 1'),
        context: context(),
        deps: deps(rows),
      });

      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.error).toBe('@core.reports/filter.failed');
    });

    it('recusa antes de varrer quando a expressão não parseia', async () => {
      const outcome = await runReportQuery({
        spec: com('valor > '),
        context: context(),
        deps: deps(rows),
      });

      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.error).toBe('@core.reports/spec.invalid');
    });

    it('`hasPermission` responde pelo conjunto do ATOR — o relatório roda como o usuário', async () => {
      const withActor = (permissions: string[]): WorkflowContext =>
        ({ ...context(), actor: { userId: 'ana', permissions } });

      const permitted = await runReportQuery({
        spec: com('hasPermission("<entity>.read")'),
        context: withActor(['lancamentos.read']),
        deps: deps(rows),
      });
      expect(permitted.ok && permitted.value.totals?.count).toBe(3);

      const empty = await runReportQuery({
        spec: com('hasPermission("<entity>.read")'),
        context: withActor([]),
        deps: deps(rows),
      });
      expect(empty.ok && empty.value.totals?.count).toBe(0);
    });
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
