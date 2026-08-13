import { describe, expect, it } from 'vitest';
import { financeiroPlugin } from '../src/plugins/marketplace/financeiro';
import { calendarPlugin } from '../src/plugins/marketplace/calendar';
import { runWorkflow } from '../functions/src/domain/engine/WorkflowExecutor';
import { makeMapStepDefinition } from '../functions/src/infrastructure/workflow/steps/MapStep';
import { makeExitStepDefinition } from '../functions/src/infrastructure/workflow/steps/ExitStep';
import { makeQueryStepDefinition } from '../functions/src/infrastructure/workflow/steps/QueryStep';
import { makeUpsertStepDefinition } from '../functions/src/infrastructure/workflow/steps/UpsertStep';
import { makeRemoveStepDefinition } from '../functions/src/infrastructure/workflow/steps/RemoveStep';
import { fakeScreenProvider } from '../functions/src/domain/repositories/fakeScreenProvider';
import type { StepRegistry } from '../functions/src/domain/engine/StepRegistry';
import type { WorkflowServices } from '../functions/src/domain/entities/WorkflowContext';
import type { WorkflowDefinition } from '../functions/src/domain/entities/Workflow';
import type { SchemaScreen } from '../functions/src/domain/schema/pathResolver';
import type { MarketplacePlugin } from '../src/domain/entities/MarketplacePlugin';

/**
 * A integração Financeiro ⇄ Calendário rodando no MOTOR de verdade, com um banco em memória que
 * GRAVA. Mora em `scripts/` pelo mesmo motivo do irmão `prazoCalendarWorkflow.test.ts`: é o único
 * lugar que enxerga as duas pontas (o pacote em `src/`, o motor em `functions/`), e o único que
 * consegue provar as promessas que não estão escritas em lugar nenhum da declaração — que rodar o
 * mutirão de novo não duplica nada, e que o arrasto carimba a data CERTA de cada situação.
 */

const screenOf = (plugin: MarketplacePlugin): SchemaScreen => {
  const screen = plugin.screens![0];
  return {
    id: screen.key,
    collection: screen.dataCollection,
    titleSingular: screen.titleSingular,
    titlePlural: screen.titlePlural,
    titleFieldKey: screen.titleFieldKey,
    fields: screen.fields.map((field) => ({ ...field, origin: 'plugin' as const })),
  };
};

/**
 * A tela do calendário como ela fica no escritório DEPOIS de instalar o Financeiro: os campos da
 * agenda mais os que o complemento acrescenta. Sem o complemento, `financialStatus`/`financialAmount`
 * seriam descartados na gravação (o `upsert` ignora caminho não declarado) — e o teste deixaria
 * passar um item pela metade.
 */
const calendarScreen = (): SchemaScreen => {
  const base = screenOf(calendarPlugin);
  const patch = financeiroPlugin.screenPatches![0];
  return {
    ...base,
    fields: [...base.fields, ...patch.fields.map((field) => ({ ...field, origin: 'plugin' as const }))],
  };
};

const screenProvider = fakeScreenProvider([screenOf(financeiroPlugin), calendarScreen()]);

const services: WorkflowServices = {
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  now: () => new Date('2026-08-13T09:00:00Z'),
};

interface Row {
  id: string;
  data: Record<string, unknown>;
}

/**
 * Um banco em memória que grava de verdade — sem ele, a segunda execução não teria como encontrar o
 * que a primeira criou, e a pergunta sobre duplicação ficaria sem resposta.
 */
const banco = (inicial: Record<string, Row[]>) => {
  const rows: Record<string, Row[]> = {};
  for (const [collection, items] of Object.entries(inicial)) {
    rows[collection] = items.map((item) => ({ id: item.id, data: { ...item.data } }));
  }
  let sequencia = 0;

  const listOf = (collection: string): Row[] => {
    if (!rows[collection]) rows[collection] = [];
    return rows[collection];
  };

  const queryRepository = {
    queryByEquality: async (_t: string, collection: string, filters: { path: string; value: unknown }[]) =>
      listOf(collection)
        .filter((row) => filters.every((filter) => row.data[filter.path] === filter.value))
        .map((row) => ({ id: row.id, data: { ...row.data } })),
  };

  const fetcher = { fetchByIds: async () => new Map<string, Record<string, unknown> | null>() };

  const mutationRepository = {
    getById: async (_t: string, collection: string, id: string) => {
      const found = listOf(collection).find((row) => row.id === id);
      return found ? { ...found.data } : null;
    },
    create: async (_t: string, collection: string, data: Record<string, unknown>) => {
      sequencia += 1;
      const id = `${collection}-${sequencia}`;
      listOf(collection).push({ id, data: { ...data } });
      return id;
    },
    update: async (_t: string, collection: string, id: string, data: Record<string, unknown>) => {
      const found = listOf(collection).find((row) => row.id === id);
      if (found) found.data = { ...found.data, ...data };
    },
    delete: async (_t: string, collection: string, id: string) => {
      rows[collection] = listOf(collection).filter((row) => row.id !== id);
    },
  };

  const definitions = [
    makeMapStepDefinition(),
    makeExitStepDefinition(),
    makeQueryStepDefinition(queryRepository, fetcher, screenProvider),
    makeUpsertStepDefinition({ mutationRepository, screenProvider }),
    makeRemoveStepDefinition({ mutationRepository, screenProvider }),
  ];

  const registry: StepRegistry = {
    register: () => undefined,
    resolve: (id) => definitions.find((definition) => definition.id === id),
    list: () => definitions,
  };

  return { registry, agenda: () => listOf('calendar'), lancamentos: () => listOf('financials') };
};

const definitionOf = (templateId: string): WorkflowDefinition => {
  const template = financeiroPlugin.workflows.find((workflow) => workflow.templateId === templateId)!;
  return {
    ...template,
    id: templateId,
    tenantId: 't1',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as WorkflowDefinition;
};

const rodar = async (registry: StepRegistry, templateId: string, name: string, payload: Record<string, unknown>) =>
  runWorkflow({
    definition: definitionOf(templateId),
    event: { id: 'evt1', tenantId: 't1', name, payload, createdAt: new Date() },
    registry,
    services,
  });

const LANCAMENTOS: Row[] = [
  {
    id: 'lanc-1',
    data: {
      type: 'Despesa',
      category: 'Custas Judiciais',
      amount: 1250.5,
      status: 'Aberto',
      dueDate: new Date('2026-08-20T12:00:00Z'),
      paymentDate: null,
      cancelDate: null,
      notes: 'Guia de recolhimento',
      personId: 'person-1',
      caseId: 'case-1',
      contractId: null,
    },
  },
  {
    id: 'lanc-2',
    data: {
      type: 'Receita',
      category: 'Honorários',
      amount: 4000,
      status: 'Aberto',
      dueDate: new Date('2026-08-25T12:00:00Z'),
      paymentDate: null,
      cancelDate: null,
      notes: '',
      personId: 'person-2',
      caseId: null,
      contractId: 'contract-1',
    },
  },
  {
    id: 'lanc-3',
    data: {
      type: 'Receita',
      category: 'Mensalidade',
      amount: 800,
      status: 'Pago',
      dueDate: new Date('2026-07-10T12:00:00Z'),
      paymentDate: new Date('2026-07-09T12:00:00Z'),
      cancelDate: null,
      notes: 'Julho',
      personId: 'person-2',
      caseId: null,
      contractId: 'contract-1',
    },
  },
];

const sincronizar = (registry: StepRegistry, status = 'Aberto') =>
  rodar(registry, 'wf-financeiro-calendar-sincronizar', 'workflow.called', { status });

const itemDe = (agenda: () => Row[], origemId: string): Row =>
  agenda().find((row) => row.data.origemId === origemId)!;

describe('mutirão "Sincronizar lançamentos no calendário"', () => {
  it('põe na agenda os lançamentos da situação escolhida, e só eles', async () => {
    const { registry, agenda } = banco({ financials: LANCAMENTOS, calendar: [] });

    const execution = await sincronizar(registry);

    expect(execution.status).toBe('SUCCESS');
    expect(execution.outputs).toMatchObject({ sincronizados: 2 });
    expect(agenda()).toHaveLength(2);
    expect(agenda().map((row) => row.data.origemId).sort()).toEqual(['lanc-1', 'lanc-2']);
    expect(agenda().every((row) => row.data.origem === 'financials')).toBe(true);
  });

  /**
   * A PROMESSA. Rodar de novo não duplica nada: cada volta pergunta se já existe item com aquele
   * `origemId` antes de gravar, e o Gravar Registro atualiza em vez de incluir.
   */
  it('rodar de novo não duplica nada — nem uma terceira vez', async () => {
    const { registry, agenda } = banco({ financials: LANCAMENTOS, calendar: [] });

    await sincronizar(registry);
    const depoisDaPrimeira = agenda().map((row) => row.id);

    await sincronizar(registry);
    await sincronizar(registry);

    expect(agenda()).toHaveLength(2);
    expect(agenda().map((row) => row.id)).toEqual(depoisDaPrimeira);
  });

  it('não duplica o que o gatilho de gravação já tinha espelhado', async () => {
    const { registry, agenda } = banco({ financials: LANCAMENTOS, calendar: [] });

    await rodar(registry, 'wf-financeiro-calendar-sync', 'financial.saved', { id: 'lanc-1', ...LANCAMENTOS[0].data });
    expect(agenda()).toHaveLength(1);

    await sincronizar(registry);

    expect(agenda()).toHaveLength(2);
    expect(agenda().filter((row) => row.data.origemId === 'lanc-1')).toHaveLength(1);
  });

  /**
   * A tradução de vocabulário é do Financeiro: a agenda só conhece `pending`/`closed` e
   * `low`…`critical`. O valor vai com SINAL — é o que distingue, no cartão, a conta a pagar do
   * honorário a receber.
   */
  it('traduz situação, tipo e valor para o vocabulário da agenda', async () => {
    const { registry, agenda } = banco({ financials: LANCAMENTOS, calendar: [] });

    await sincronizar(registry);

    expect(itemDe(agenda, 'lanc-1').data).toMatchObject({
      title: 'Custas Judiciais',
      status: 'pending',
      priority: 'high',
      description: 'Guia de recolhimento',
      origem: 'financials',
      origemId: 'lanc-1',
      financialStatus: 'Aberto',
      financialAmount: -1250.5,
      financialPersonId: 'person-1',
    });
    expect(itemDe(agenda, 'lanc-1').data.date).toBeInstanceOf(Date);
    // Receita entra positiva e em "baixa" — a faixa verde do cartão.
    expect(itemDe(agenda, 'lanc-2').data).toMatchObject({ priority: 'low', financialAmount: 4000 });
  });

  it('o lançamento pago vira item concluído, com a data do pagamento', async () => {
    const { registry, agenda } = banco({ financials: LANCAMENTOS, calendar: [] });

    await sincronizar(registry, 'Pago');
    const item = itemDe(agenda, 'lanc-3');

    expect(item.data.status).toBe('closed');
    expect(item.data.financialStatus).toBe('Pago');
    expect(item.data.finishDate).toBeInstanceOf(Date);
  });

  /**
   * A lista de situações é do escritório (`optionsAllowUserAdd`). Uma situação que ele invente
   * depois não pode sumir da agenda como se estivesse resolvida: a tradução pergunta pelo que
   * ENCERRA, não pelo que está aberto.
   */
  it('situação que o escritório inventar nasce pendente, não concluída', async () => {
    const parcial: Row[] = [{ id: 'lanc-9', data: { ...LANCAMENTOS[0].data, status: 'Parcialmente pago' } }];
    const { registry, agenda } = banco({ financials: parcial, calendar: [] });

    await sincronizar(registry, 'Parcialmente pago');

    expect(itemDe(agenda, 'lanc-9').data.status).toBe('pending');
  });

  it('sem lançamento naquela situação não grava nada e diz quantos foram', async () => {
    const { registry, agenda } = banco({ financials: LANCAMENTOS, calendar: [] });

    const execution = await sincronizar(registry, 'Cancelado');

    expect(agenda()).toEqual([]);
    expect(execution.outputs).toMatchObject({ sincronizados: 0 });
    expect(String((execution.outputs as { status?: unknown }).status)).toContain('0 lançamento(s)');
  });
});

describe('espelho, remoção e gestos do lançamento na agenda', () => {
  it('depois do mutirão, alterar o lançamento atualiza o mesmo item', async () => {
    const { registry, agenda } = banco({ financials: LANCAMENTOS, calendar: [] });

    await sincronizar(registry);
    const antes = itemDe(agenda, 'lanc-1');

    await rodar(registry, 'wf-financeiro-calendar-sync', 'financial.saved', {
      id: 'lanc-1',
      ...LANCAMENTOS[0].data,
      status: 'Pago',
      paymentDate: new Date('2026-08-18T12:00:00Z'),
    });

    expect(agenda()).toHaveLength(2);
    const depois = itemDe(agenda, 'lanc-1');
    expect(depois.id).toBe(antes.id);
    expect(depois.data.status).toBe('closed');
    expect(depois.data.finishDate).toBeInstanceOf(Date);
  });

  it('excluir o lançamento tira o item da agenda', async () => {
    const { registry, agenda } = banco({ financials: LANCAMENTOS, calendar: [] });

    await sincronizar(registry);
    expect(agenda()).toHaveLength(2);

    await rodar(registry, 'wf-financeiro-calendar-remover', 'financial.deleted', { id: 'lanc-1' });

    expect(agenda()).toHaveLength(1);
    expect(agenda()[0].data.origemId).toBe('lanc-2');
  });

  it('excluir um lançamento sem item na agenda encerra sem erro', async () => {
    const { registry, agenda } = banco({ financials: LANCAMENTOS, calendar: [] });

    const execution = await rodar(registry, 'wf-financeiro-calendar-remover', 'financial.deleted', { id: 'lanc-9' });

    expect(execution.status).toBe('SUCCESS');
    expect(agenda()).toEqual([]);
  });

  /**
   * O gesto do cartão grava no LANÇAMENTO, nunca no item — quem atualiza a agenda é o espelho, na
   * sequência. O `event.context` é o item da agenda, e o lançamento está no `origemId` dele.
   */
  it('registrar pagamento pelo cartão grava no lançamento, e o espelho reage', async () => {
    const { registry, agenda, lancamentos } = banco({ financials: LANCAMENTOS, calendar: [] });

    await sincronizar(registry);
    const item = itemDe(agenda, 'lanc-1');

    const execution = await rodar(registry, 'wf-financeiro-calendar-pagar', 'workflow.called', {
      context: { ...item.data, id: item.id },
    });

    expect(execution.status).toBe('SUCCESS');
    const lancamento = lancamentos().find((row) => row.id === 'lanc-1')!;
    expect(lancamento.data.status).toBe('Pago');
    expect(lancamento.data.paymentDate).toBeTruthy();

    await rodar(registry, 'wf-financeiro-calendar-sync', 'financial.saved', { id: 'lanc-1', ...lancamento.data });
    expect(itemDe(agenda, 'lanc-1').data.status).toBe('closed');
  });

  /**
   * O arrasto carimba a data que o cartão está MOSTRANDO, e é a situação do lançamento que diz qual
   * é — a agenda só sabe "pendente" ou "concluído", e pago e cancelado são ambos concluídos para
   * ela.
   */
  it.each([
    ['Aberto', 'dueDate'],
    ['Pago', 'paymentDate'],
    ['Cancelado', 'cancelDate'],
  ])('arrastar um lançamento %s muda a data de %s', async (financialStatus, campo) => {
    const { registry, lancamentos } = banco({
      financials: [{ id: 'lanc-1', data: { ...LANCAMENTOS[0].data, status: financialStatus } }],
      calendar: [],
    });

    const execution = await rodar(registry, 'wf-financeiro-calendar-mover', 'workflow.called', {
      targetDate: '2026-09-01',
      context: { origem: 'financials', origemId: 'lanc-1', financialStatus },
    });

    expect(execution.status).toBe('SUCCESS');
    const lancamento = lancamentos()[0].data;
    expect((lancamento[campo] as Date).toISOString().slice(0, 10)).toBe('2026-09-01');
    // As outras duas datas ficam onde estavam: o arrasto muda uma só.
    for (const outro of ['dueDate', 'paymentDate', 'cancelDate'].filter((key) => key !== campo)) {
      expect(lancamento[outro]).toEqual(LANCAMENTOS[0].data[outro]);
    }
  });
});
