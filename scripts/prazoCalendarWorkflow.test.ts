import { describe, expect, it } from 'vitest';
import { prazoPlugin } from '../src/plugins/marketplace/prazo';
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
 * A integração Prazo ⇄ Calendário rodando no MOTOR de verdade, com um banco em memória que GRAVA —
 * é o que permite executar o mesmo workflow duas vezes e conferir o que sobrou.
 *
 * Mora em `scripts/` pelo mesmo motivo do irmão `prazoCriarWorkflow.test.ts`: é o único lugar que
 * enxerga as duas pontas (o pacote em `src/`, o motor em `functions/`). E é o único que consegue
 * provar a promessa central do mutirão — **rodar de novo não duplica nada** —, porque essa promessa
 * não está escrita em lugar nenhum da declaração: ela EMERGE da pergunta que cada volta faz antes de
 * gravar. Um teste sobre a forma da declaração não a alcançaria.
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
 * A tela do calendário como ela fica no escritório DEPOIS de instalar o Prazo: os campos da agenda
 * mais os que o complemento acrescenta. Sem o complemento, `caseId`/`personId` seriam descartados na
 * gravação (o `upsert` ignora caminho não declarado) — e o teste deixaria passar um item pela metade.
 */
const calendarScreen = (): SchemaScreen => {
  const base = screenOf(calendarPlugin);
  const patch = prazoPlugin.screenPatches![0];
  return {
    ...base,
    fields: [...base.fields, ...patch.fields.map((field) => ({ ...field, origin: 'plugin' as const }))],
  };
};

const screenProvider = fakeScreenProvider([screenOf(prazoPlugin), calendarScreen()]);

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

  return { registry, agenda: () => listOf('calendar'), prazos: () => listOf('deadlines') };
};

const definitionOf = (templateId: string): WorkflowDefinition => {
  const template = prazoPlugin.workflows.find((workflow) => workflow.templateId === templateId)!;
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

const PRAZOS: Row[] = [
  {
    id: 'prazo-1',
    data: {
      type: 'Petição',
      status: 'Pendente',
      priority: 'Crítica',
      dueDate: new Date('2026-08-20T12:00:00Z'),
      completedAt: null,
      description: 'Contrarrazões',
      caseId: 'case-1',
      responsibleLawyerId: 'person-1',
    },
  },
  {
    id: 'prazo-2',
    data: {
      type: 'Audiência',
      status: 'Pendente',
      priority: 'Baixa',
      dueDate: new Date('2026-08-25T12:00:00Z'),
      completedAt: null,
      description: '',
      caseId: 'case-2',
      responsibleLawyerId: null,
    },
  },
  {
    id: 'prazo-3',
    data: {
      type: 'Recurso',
      status: 'Concluído',
      priority: 'Alta',
      dueDate: new Date('2026-07-10T12:00:00Z'),
      completedAt: new Date('2026-07-09T12:00:00Z'),
      description: 'Já entregue',
      caseId: 'case-1',
      responsibleLawyerId: 'person-1',
    },
  },
];

const sincronizar = (registry: StepRegistry, status = 'Pendente') =>
  rodar(registry, 'wf-prazo-calendar-sincronizar', 'workflow.called', { status });

describe('mutirão "Sincronizar prazos no calendário"', () => {
  it('põe na agenda os prazos da situação escolhida, e só eles', async () => {
    const { registry, agenda } = banco({ deadlines: PRAZOS, calendar: [] });

    const execution = await sincronizar(registry);

    expect(execution.status).toBe('SUCCESS');
    expect(execution.outputs).toMatchObject({ sincronizados: 2 });
    expect(agenda()).toHaveLength(2);
    expect(agenda().map((row) => row.data.origemId).sort()).toEqual(['prazo-1', 'prazo-2']);
    // O prazo concluído ficou de fora porque a execução foi da situação "Pendente" — é o parâmetro
    // que fatia, e é rodando por situação que o escritório cobre tudo.
    expect(agenda().every((row) => row.data.origem === 'deadlines')).toBe(true);
  });

  /**
   * A PROMESSA. Rodar de novo não duplica nada: cada volta pergunta se já existe item com aquele
   * `origemId` antes de gravar, e o Gravar Registro atualiza em vez de incluir.
   */
  it('rodar de novo não duplica nada — nem uma terceira vez', async () => {
    const { registry, agenda } = banco({ deadlines: PRAZOS, calendar: [] });

    await sincronizar(registry);
    const depoisDaPrimeira = agenda().map((row) => row.id);

    await sincronizar(registry);
    await sincronizar(registry);

    expect(agenda()).toHaveLength(2);
    // Os MESMOS documentos: não é "duas execuções, dois itens parecidos" — é o mesmo item reescrito.
    expect(agenda().map((row) => row.id)).toEqual(depoisDaPrimeira);
  });

  /**
   * O mutirão e o gatilho de gravação são a mesma declaração por portas diferentes. Um prazo que já
   * foi espelhado pelo gatilho não pode ganhar um segundo item quando o mutirão passar por ele.
   */
  it('não duplica o que o gatilho de gravação já tinha espelhado', async () => {
    const { registry, agenda } = banco({ deadlines: PRAZOS, calendar: [] });

    await rodar(registry, 'wf-prazo-calendar-sync', 'deadline.saved', { id: 'prazo-1', ...PRAZOS[0].data });
    expect(agenda()).toHaveLength(1);

    await sincronizar(registry);

    expect(agenda()).toHaveLength(2);
    expect(agenda().filter((row) => row.data.origemId === 'prazo-1')).toHaveLength(1);
  });

  it('traduz situação e prioridade para as chaves da agenda, e leva os campos do complemento', async () => {
    const { registry, agenda } = banco({ deadlines: PRAZOS, calendar: [] });

    await sincronizar(registry);
    const item = agenda().find((row) => row.data.origemId === 'prazo-1')!;

    expect(item.data).toMatchObject({
      title: 'Petição',
      status: 'pending',
      priority: 'critical',
      description: 'Contrarrazões',
      origem: 'deadlines',
      origemId: 'prazo-1',
      caseId: 'case-1',
      personId: 'person-1',
    });
    expect(item.data.date).toBeInstanceOf(Date);
  });

  it('o prazo concluído vira item concluído, com a data da conclusão', async () => {
    const { registry, agenda } = banco({ deadlines: PRAZOS, calendar: [] });

    await sincronizar(registry, 'Concluído');
    const item = agenda().find((row) => row.data.origemId === 'prazo-3')!;

    expect(item.data.status).toBe('closed');
    expect(item.data.priority).toBe('high');
    expect(item.data.finishDate).toBeInstanceOf(Date);
  });

  /**
   * O mutirão alcança o que já existia; o gatilho mantém dali em diante. Depois de sincronizar, uma
   * alteração no prazo tem de reescrever o MESMO item — senão o mutirão teria criado um espelho que
   * a rotina normal não reconhece.
   */
  it('depois do mutirão, alterar o prazo atualiza o mesmo item', async () => {
    const { registry, agenda } = banco({ deadlines: PRAZOS, calendar: [] });

    await sincronizar(registry);
    const antes = agenda().find((row) => row.data.origemId === 'prazo-1')!;

    await rodar(registry, 'wf-prazo-calendar-sync', 'deadline.saved', {
      id: 'prazo-1',
      ...PRAZOS[0].data,
      status: 'Concluído',
      completedAt: new Date('2026-08-18T12:00:00Z'),
    });

    expect(agenda()).toHaveLength(2);
    const depois = agenda().find((row) => row.data.origemId === 'prazo-1')!;
    expect(depois.id).toBe(antes.id);
    expect(depois.data.status).toBe('closed');
  });

  it('a agenda vazia de prazos daquela situação não grava nada e diz quantos foram', async () => {
    const { registry, agenda } = banco({ deadlines: PRAZOS, calendar: [] });

    const execution = await sincronizar(registry, 'Cancelado');

    expect(agenda()).toEqual([]);
    expect(execution.outputs).toMatchObject({ sincronizados: 0 });
    expect(String((execution.outputs as { status?: unknown }).status)).toContain('0 prazo(s)');
  });
});

describe('espelho e remoção do prazo na agenda', () => {
  it('excluir o prazo tira o item da agenda', async () => {
    const { registry, agenda } = banco({ deadlines: PRAZOS, calendar: [] });

    await sincronizar(registry);
    expect(agenda()).toHaveLength(2);

    await rodar(registry, 'wf-prazo-calendar-remover', 'deadline.deleted', { id: 'prazo-1', ...PRAZOS[0].data });

    expect(agenda()).toHaveLength(1);
    expect(agenda()[0].data.origemId).toBe('prazo-2');
  });

  /**
   * Prazo sem item na agenda (nunca sincronizado, ou já removido) não pode fazer a exclusão falhar:
   * o fluxo encerra antes do Excluir Registro, que recusaria um id vazio.
   */
  it('excluir um prazo sem item na agenda encerra sem erro', async () => {
    const { registry, agenda } = banco({ deadlines: PRAZOS, calendar: [] });

    const execution = await rodar(registry, 'wf-prazo-calendar-remover', 'deadline.deleted', { id: 'prazo-9' });

    expect(execution.status).toBe('SUCCESS');
    expect(agenda()).toEqual([]);
  });
});
