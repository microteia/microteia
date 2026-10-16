import { describe, it, expect } from 'vitest';
import { WorkflowContextHydrator, createHydrationCache } from './WorkflowContextHydrator';
import type { IWorkflowRecordFetcher } from '../repositories/IWorkflowRecordFetcher';
import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import type { SchemaScreen } from '../schema/pathResolver';
import type { InputMapping, WorkflowDefinition, WorkflowEvent, WorkflowStep } from '../entities/Workflow';
import type { IWorkflowMutationRepository } from '../repositories/IWorkflowMutationRepository';
import type { StepRegistry } from './StepRegistry';
import type { StepDefinition } from './StepDefinition';
import { hydrateAndRunWorkflow } from './hydrateAndRunWorkflow';
import { makeMapStepDefinition } from '../../infrastructure/workflow/steps/MapStep';
import { makeUpsertStepDefinition } from '../../infrastructure/workflow/steps/UpsertStep';
import { fakeScreenProvider } from '../../domain/repositories/fakeScreenProvider';

const screens: SchemaScreen[] = [
  // Processo é declarado por extensão: a coleção, o prefixo dos eventos e os campos — inclusive a
  // relação com Contrato — vêm da tela, não de um registro no kernel.
  {
    id: 'processos',
    collection: 'cases',
    eventPrefix: 'case',
    titleSingular: 'Processo',
    titleFieldKey: 'title',
    fields: [
      { key: 'caseNumber', label: 'Número', type: 'text', required: false, order: 0, origin: 'plugin' },
      { key: 'contractId', label: 'Contrato', type: 'reference', refEntity: 'contracts', refDenormKey: 'contract', required: false, order: 1, origin: 'plugin' },
      { key: 'tarefa', label: 'Tarefa', type: 'reference', refEntity: 'tarefas', required: false, order: 2, origin: 'design' },
    ],
  },
  // Contrato também vem de extensão — é a tela dele que dá o segundo salto (`contract.client`).
  {
    id: 'contratos',
    collection: 'contracts',
    eventPrefix: 'contract',
    titleSingular: 'Contrato',
    titleFieldKey: 'title',
    fields: [
      { key: 'number', label: 'Número', type: 'text', required: false, order: 0, origin: 'plugin' },
      { key: 'status', label: 'Status', type: 'text', required: false, order: 1, origin: 'plugin' },
      { key: 'clientId', label: 'Cliente', type: 'reference', refEntity: 'persons', refDenormKey: 'client', required: false, order: 2, origin: 'plugin' },
    ],
  },
  {
    id: 'tarefas',
    titleSingular: 'Tarefa',
    titleFieldKey: 'nome',
    fields: [{ key: 'nome', label: 'Nome', type: 'text', required: false, order: 0, origin: 'design' }],
  },
  {
    id: 'persons',
    titleSingular: 'Pessoa',
    titleFieldKey: 'name',
    fields: [{ key: 'apelido', label: 'Apelido', type: 'text', required: false, order: 0, origin: 'design' }],
  },
];

const database: Record<string, Record<string, Record<string, unknown>>> = {
  contracts: {
    c1: { number: '001/2026', title: 'Contrato Atual', type: 'Honorários', status: 'Ativo', clientId: 'p1' },
    c2: { number: '099/2020', title: 'Contrato Antigo', type: 'Honorários', status: 'Encerrado' },
  },
  persons: {
    p1: {
      name: 'Maria Silva',
      type: 'Pessoa Física',
      email: 'maria@x.com',
      address: { city: 'São Paulo', state: 'SP' },
      apelido: 'Mari',
    },
    p2: { name: 'João Souza', type: 'Pessoa Física' },
  },
  tarefas: {
    t1: { nome: 'Elaborar petição' },
  },
};

const createFakeFetcher = (): { fetcher: IWorkflowRecordFetcher; calls: string[] } => {
  const calls: string[] = [];
  const fetcher: IWorkflowRecordFetcher = {
    fetchByIds: (tenantId, collection, ids) => {
      calls.push(`${collection}:${[...ids].sort().join(',')}`);
      return Promise.resolve(new Map(ids.map((id) => [id, database[collection]?.[id] ?? null])));
    },
  };
  return { fetcher, calls };
};

const screenProvider: IScreenDefinitionProvider = fakeScreenProvider(screens);

const makeEvent = (payload: Record<string, unknown>): WorkflowEvent => ({
  id: 'evt1',
  tenantId: 'tenant1',
  name: 'case.saved',
  payload,
  timestamp: new Date(),
});

const makeDefinition = (partial: Partial<WorkflowDefinition>): WorkflowDefinition => ({
  id: 'wf1',
  tenantId: 'tenant1',
  name: 'Teste',
  eventName: 'case.saved',
  enabled: true,
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...partial,
});

describe('collectReferencedPaths', () => {
  it('coleta caminhos de condições, expressões e mappings normalizados para o payload', () => {
    const definition = makeDefinition({
      condition: {
        kind: 'LogicalAnd',
        conditions: [
          { kind: 'FieldComparison', fieldPath: 'event.payload.contract.status', operator: '==', value: 'Ativo', valueType: 'literal' },
          { kind: 'FieldComparison', fieldPath: 'event.payload.status', operator: '==', value: 'event.payload.old.status', valueType: 'eventField' },
          { kind: 'Not', condition: { kind: 'Expression', expression: 'length(event.tarefa.nome) > 3' } },
        ],
      },
      steps: [
        {
          id: 's1',
          stepDefinitionId: 'CreateDeadline',
          type: 'Action',
          order: 0,
          enabled: true,
          configuration: {
            caseId: { kind: 'Event', path: 'id' },
            description: { kind: 'Expression', expression: 'concat(event.contract.client.name, " - ", event.caseNumber)' },
          },
        },
      ],
    });

    const hydrator = new WorkflowContextHydrator(createFakeFetcher().fetcher, screenProvider);
    const paths = hydrator.collectReferencedPaths(definition).sort();
    expect(paths).toStrictEqual(
      [
        'contract.status',
        'status',
        'old.status',
        'tarefa.nome',
        'id',
        'contract.client.name',
        'caseNumber',
      ].sort(),
    );
  });

  it('coleta mappings aninhados em Literal composto: fields do map, where do query e id do remove', () => {
    const definition = makeDefinition({
      steps: [
        {
          id: 'map',
          stepDefinitionId: 'map',
          type: 'Action',
          order: 0,
          enabled: true,
          configuration: {
            map: {
              kind: 'Literal',
              value: {
                name: 'resumo',
                fields: [
                  { name: 'cliente', value: { kind: 'Expression', expression: 'event.contract.client.name' } },
                  { name: 'tarefa', value: { kind: 'Event', path: 'tarefa.nome' } },
                  { name: 'fixo', value: { kind: 'Literal', value: 'x' } },
                ],
              },
            },
          },
        },
        {
          id: 'query',
          stepDefinitionId: 'query',
          type: 'Action',
          order: 1,
          enabled: true,
          configuration: {
            query: {
              kind: 'Literal',
              value: {
                table: 'contracts',
                where: [{ path: 'status', op: 'eq', value: { kind: 'Expression', expression: 'event.contract.status' } }],
                limit: 10,
                projections: [],
              },
            },
          },
        },
        {
          id: 'remove',
          stepDefinitionId: 'remove',
          type: 'Action',
          order: 2,
          enabled: true,
          configuration: {
            remove: { kind: 'Literal', value: { table: 'tarefas', id: { kind: 'Event', path: 'tarefa.id' } } },
          },
        },
      ],
    });

    const hydrator = new WorkflowContextHydrator(createFakeFetcher().fetcher, screenProvider);
    expect(hydrator.collectReferencedPaths(definition).sort()).toStrictEqual(
      ['contract.client.name', 'tarefa.nome', 'contract.status', 'tarefa.id'].sort(),
    );
  });

  it('coleta a condição de um nó Condition, e não só a do fluxo', () => {
    const definition = makeDefinition({
      steps: [
        {
          id: 'if',
          stepDefinitionId: '',
          type: 'Condition',
          order: 0,
          enabled: true,
          configuration: {},
          condition: { kind: 'Expression', expression: 'event.contract.status == "Ativo"' },
          branches: { whenTrue: [], whenFalse: [] },
        },
      ],
    });

    const hydrator = new WorkflowContextHydrator(createFakeFetcher().fetcher, screenProvider);
    expect(hydrator.collectReferencedPaths(definition)).toStrictEqual(['contract.status']);
  });

  it('o caminho aninhado num map chega hidratado ao payload', async () => {
    const definition = makeDefinition({
      steps: [
        {
          id: 'map',
          stepDefinitionId: 'map',
          type: 'Action',
          order: 0,
          enabled: true,
          configuration: {
            map: {
              kind: 'Literal',
              value: { fields: [{ name: 'cliente', value: { kind: 'Expression', expression: 'event.contract.client.name' } }] },
            },
          },
        },
      ],
    });

    const hydrator = new WorkflowContextHydrator(createFakeFetcher().fetcher, screenProvider);
    const hydrated = await hydrator.hydrate(
      makeEvent({ id: 'k1', contractId: 'c1' }),
      hydrator.collectReferencedPaths(definition),
      createHydrationCache(),
    );
    const contract = hydrated.payload.contract as Record<string, unknown>;
    expect((contract.client as Record<string, unknown>).name).toBe('Maria Silva');
  });
});

describe('hydrate', () => {
  it('hidrata FK em 2 saltos, reference de tela e old, com fetch em lote por coleção', async () => {
    const { fetcher, calls } = createFakeFetcher();
    const hydrator = new WorkflowContextHydrator(fetcher, screenProvider);
    const event = makeEvent({
      id: 'case1',
      caseNumber: '0001',
      contractId: 'c1',
      tarefa: 't1',
      old: { contractId: 'c2' },
    });

    const hydrated = await hydrator.hydrate(
      event,
      ['contract.client.name', 'tarefa.nome', 'old.contract.number'],
      createHydrationCache(),
    );

    const payload = hydrated.payload;
    expect(payload.contract).toMatchObject({ id: 'c1', number: '001/2026' });
    expect((payload.contract as Record<string, unknown>).client).toMatchObject({ id: 'p1', name: 'Maria Silva' });
    expect(payload.tarefa).toMatchObject({ id: 't1', nome: 'Elaborar petição' });
    expect((payload.old as Record<string, unknown>).contract).toMatchObject({ id: 'c2', number: '099/2020' });

    expect(calls).toStrictEqual(['contracts:c1,c2', 'tarefas:t1', 'persons:p1']);
  });

  it('busca o registro completo quando o caminho acessa campo fora do conjunto denormalizado', async () => {
    const { fetcher, calls } = createFakeFetcher();
    const hydrator = new WorkflowContextHydrator(fetcher, screenProvider);
    const event = makeEvent({ id: 'case1', contractId: 'c1' });

    const hydrated = await hydrator.hydrate(event, ['contract.client.address.city'], createHydrationCache());

    const contract = hydrated.payload.contract as Record<string, unknown>;
    const client = contract.client as Record<string, unknown>;
    expect(client).toMatchObject({ id: 'p1', name: 'Maria Silva', address: { city: 'São Paulo' } });
    expect(calls).toStrictEqual(['contracts:c1', 'persons:p1']);
  });

  it('completa denormalização parcial já presente no payload buscando campo ausente', async () => {
    const { fetcher, calls } = createFakeFetcher();
    const hydrator = new WorkflowContextHydrator(fetcher, screenProvider);
    const event = makeEvent({
      id: 'case1',
      contractId: 'c1',
      contract: { id: 'c1', number: '001/2026', clientId: 'p1', client: { id: 'p1', name: 'Maria Silva' } },
    });

    const hydrated = await hydrator.hydrate(event, ['contract.client.address.city'], createHydrationCache());

    const contract = hydrated.payload.contract as Record<string, unknown>;
    const client = contract.client as Record<string, unknown>;
    expect(client).toMatchObject({ id: 'p1', name: 'Maria Silva', address: { city: 'São Paulo' } });
    expect(calls).toStrictEqual(['persons:p1']);
  });

  it('hidrata campo declarado pelo tenant num registro vinculado, na raiz', async () => {
    const { fetcher, calls } = createFakeFetcher();
    const hydrator = new WorkflowContextHydrator(fetcher, screenProvider);
    const event = makeEvent({ id: 'case1', contractId: 'c1' });

    const hydrated = await hydrator.hydrate(event, ['contract.client.apelido'], createHydrationCache());

    const contract = hydrated.payload.contract as Record<string, unknown>;
    const client = contract.client as Record<string, unknown>;
    expect(client).toMatchObject({ id: 'p1', name: 'Maria Silva', apelido: 'Mari' });
    expect(calls).toStrictEqual(['contracts:c1', 'persons:p1']);
  });

  it('registro sem o campo declarado apenas não o traz — não há envelope a criar', async () => {
    const { fetcher } = createFakeFetcher();
    const hydrator = new WorkflowContextHydrator(fetcher, screenProvider);
    const event = makeEvent({ id: 'case1', contractId: 'c1' });
    database.contracts.c1.clientId = 'p2';

    const hydrated = await hydrator.hydrate(event, ['contract.client.apelido'], createHydrationCache());

    const contract = hydrated.payload.contract as Record<string, unknown>;
    const client = contract.client as Record<string, unknown>;
    expect(client).toMatchObject({ id: 'p2', name: 'João Souza' });
    expect(client.apelido).toBeUndefined();

    database.contracts.c1.clientId = 'p1';
  });

  it('reutiliza o cache entre hidratações do mesmo evento', async () => {
    const { fetcher, calls } = createFakeFetcher();
    const hydrator = new WorkflowContextHydrator(fetcher, screenProvider);
    const cache = createHydrationCache();
    const event = makeEvent({ id: 'case1', contractId: 'c1' });

    await hydrator.hydrate(event, ['contract.number'], cache);
    await hydrator.hydrate(event, ['contract.title'], cache);

    expect(calls).toStrictEqual(['contracts:c1']);
  });

  it('mantém {id} para documento inexistente e ignora caminhos inválidos com warning', async () => {
    const { fetcher } = createFakeFetcher();
    const hydrator = new WorkflowContextHydrator(fetcher, screenProvider);
    const warnings: string[] = [];
    const logger = { info: () => {}, warn: (m: string) => warnings.push(m), error: () => {} };

    const hydrated = await hydrator.hydrate(
      makeEvent({ id: 'case1', contractId: 'inexistente', caseNumber: '0001' }),
      ['contract.number', 'caseNumber.x'],
      createHydrationCache(),
      logger,
    );

    expect(hydrated.payload.contract).toStrictEqual({ id: 'inexistente' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('caseNumber.x');
  });

  it('não altera o evento sem caminhos com FK nem sem raiz conhecida', async () => {
    const { fetcher, calls } = createFakeFetcher();
    const hydrator = new WorkflowContextHydrator(fetcher, screenProvider);
    const event = makeEvent({ id: 'case1', status: 'Ativo' });

    const same = await hydrator.hydrate(event, ['status'], createHydrationCache());
    expect(same).toBe(event);

    const unknownEvent = { ...event, name: 'desconhecido.saved' };
    expect(await hydrator.hydrate(unknownEvent, ['x.y'], createHydrationCache())).toBe(unknownEvent);
    expect(calls).toStrictEqual([]);
  });

  it('não sobrescreve materialização eager já presente no payload', async () => {
    const { fetcher, calls } = createFakeFetcher();
    const hydrator = new WorkflowContextHydrator(fetcher, screenProvider);
    const event = makeEvent({
      id: 'case1',
      contractId: 'c1',
      contract: { id: 'c1', number: 'eager' },
    });

    const hydrated = await hydrator.hydrate(event, ['contract.number'], createHydrationCache());
    expect((hydrated.payload.contract as Record<string, unknown>).number).toBe('eager');
    expect(calls).toStrictEqual([]);
  });
});

describe('referência lida sozinha numa automação é o id (regressão da 9.108.1)', () => {
  const deadlineScreens: SchemaScreen[] = [
    {
      id: 'processos',
      collection: 'cases',
      eventPrefix: 'case',
      titleSingular: 'Processo',
      titleFieldKey: 'title',
      fields: [{ key: 'court', label: 'Tribunal', type: 'text', required: false, order: 0, origin: 'plugin' }],
    },
    {
      id: 'agendas',
      collection: 'calendars',
      titleSingular: 'Agenda',
      titleFieldKey: 'name',
      fields: [{ key: 'name', label: 'Nome', type: 'text', required: false, order: 0, origin: 'plugin' }],
    },
    {
      id: 'persons',
      titleSingular: 'Pessoa',
      titleFieldKey: 'name',
      fields: [{ key: 'name', label: 'Nome', type: 'text', required: false, order: 0, origin: 'plugin' }],
    },
    {
      id: 'eventos',
      collection: 'calendarEvents',
      titleSingular: 'Evento',
      titleFieldKey: 'title',
      fields: [
        { key: 'title', label: 'Título', type: 'text', required: false, order: 0, origin: 'plugin' },
        { key: 'caseId', label: 'Processo', type: 'reference', refEntity: 'cases', required: false, order: 1, origin: 'plugin' },
        { key: 'personId', label: 'Pessoa', type: 'reference', refEntity: 'persons', required: false, order: 2, origin: 'plugin' },
      ],
    },
    {
      id: 'prazos',
      collection: 'deadlines',
      eventPrefix: 'deadline',
      titleSingular: 'Prazo',
      titleFieldKey: 'title',
      fields: [
        { key: 'title', label: 'Título', type: 'text', required: false, order: 0, origin: 'plugin' },
        { key: 'caseId', label: 'Processo', type: 'reference', refEntity: 'cases', required: false, order: 1, origin: 'plugin' },
        { key: 'responsibleLawyerId', label: 'Responsável', type: 'reference', refEntity: 'persons', required: false, order: 2, origin: 'plugin' },
        { key: 'calendars', label: 'Agendas', type: 'reference', refEntity: 'calendars', multi: true, required: false, order: 3, origin: 'plugin' },
      ],
    },
  ];

  const deadlineDatabase: Record<string, Record<string, Record<string, unknown>>> = {
    cases: { k1: { title: 'Ação de cobrança', court: 'TJBA' } },
    calendars: { a1: { name: 'Agenda A' }, a2: { name: 'Agenda B' } },
    persons: { p1: { name: 'Maria Silva' } },
  };

  const countingFetcher = (): { fetcher: IWorkflowRecordFetcher; calls: string[] } => {
    const calls: string[] = [];
    return {
      calls,
      fetcher: {
        fetchByIds: (_tenantId, collection, ids) => {
          calls.push(`${collection}:${[...ids].sort().join(',')}`);
          return Promise.resolve(new Map(ids.map((id) => [id, deadlineDatabase[collection]?.[id] ?? null])));
        },
      },
    };
  };

  class MemoryMutationRepository implements IWorkflowMutationRepository {
    readonly written: { collection: string; data: Record<string, unknown> }[] = [];

    getById = () => Promise.resolve(null);

    newId = () => 'novo';

    create = (_tenantId: string, collection: string, data: Record<string, unknown>) => {
      this.written.push({ collection, data });
      return Promise.resolve('novo');
    };

    update = (_tenantId: string, collection: string, _id: string, data: Record<string, unknown>) => {
      this.written.push({ collection, data });
      return Promise.resolve();
    };

    delete = () => Promise.resolve();
  }

  const deadlineScreenProvider = fakeScreenProvider(deadlineScreens);
  const logger = { info: () => undefined, warn: () => undefined, error: () => undefined };

  const mapStep = (id: string, order: number, name: string, fields: Record<string, InputMapping>): WorkflowStep => ({
    id,
    stepDefinitionId: 'map',
    type: 'Action',
    order,
    enabled: true,
    configuration: {
      map: {
        kind: 'Literal',
        value: { name, fields: Object.entries(fields).map(([field, value]) => ({ name: field, value })) },
      },
    },
  });

  const run = async (steps: WorkflowStep[], payload: Record<string, unknown>, repository = new MemoryMutationRepository()) => {
    const { fetcher, calls } = countingFetcher();
    let outputs: Record<string, Record<string, unknown>> = {};
    const capture: StepDefinition = {
      ...makeMapStepDefinition(),
      id: 'capture',
      inputs: [],
      createExecutor: () => ({
        execute: async (_inputs, context) => {
          outputs = context.outputs;
          return { success: true };
        },
      }),
    };
    const registry: StepRegistry = {
      register: () => undefined,
      resolve: (id) =>
        id === 'map'
          ? makeMapStepDefinition()
          : id === 'upsert'
            ? makeUpsertStepDefinition({ mutationRepository: repository, screenProvider: deadlineScreenProvider })
            : id === 'capture'
              ? capture
              : undefined,
      list: () => [],
    };
    const captureStep: WorkflowStep = { id: 'capture', stepDefinitionId: 'capture', type: 'Action', order: 99, enabled: true, configuration: {} };
    const execution = await hydrateAndRunWorkflow(
      makeDefinition({ eventName: 'deadline.saved', steps: [...steps, captureStep] }),
      { id: 'evt1', tenantId: 'tenant1', name: 'deadline.saved', payload, timestamp: new Date() },
      {
        registry,
        services: { logger, now: () => new Date('2026-10-15T12:00:00Z') },
        hydrator: new WorkflowContextHydrator(fetcher, deadlineScreenProvider),
      },
    );
    expect(execution.status).toBe('SUCCESS');
    return { outputs, calls, repository };
  };

  const expression = (text: string): InputMapping => ({ kind: 'Expression', expression: text });

  it('a referência copiada num map é o id, e nada é lido', async () => {
    const { outputs, calls } = await run(
      [mapStep('m', 0, 'agenda', { caseId: expression('event.caseId'), personId: { kind: 'Event', path: 'responsibleLawyerId' } })],
      { id: 'd1', caseId: 'k1', responsibleLawyerId: 'p1' },
    );

    expect(outputs.m.agenda).toStrictEqual({ caseId: 'k1', personId: 'p1' });
    expect(calls).toStrictEqual([]);
  });

  it('outro passo navegando a mesma referência recebe o campo, e o map continua recebendo o id', async () => {
    const { outputs, calls } = await run(
      [
        mapStep('m1', 0, 'tribunal', { court: expression('event.caseId.court') }),
        mapStep('m2', 1, 'agenda', {
          caseId: expression('event.caseId'),
          sameExpression: expression('concat(event.caseId, "@", event.caseId.court)'),
          caseIdEvent: { kind: 'Event', path: 'caseId' },
          explicitId: expression('event.caseId.id'),
        }),
      ],
      { id: 'd1', caseId: 'k1' },
    );

    expect(outputs.m1.tribunal).toStrictEqual({ court: 'TJBA' });
    expect(outputs.m2.agenda).toStrictEqual({ caseId: 'k1', sameExpression: 'k1@TJBA', caseIdEvent: 'k1', explicitId: 'k1' });
    expect(calls).toStrictEqual(['cases:k1']);
  });

  it('referência vazia: sozinha é null, navegada é null, sem erro', async () => {
    const { outputs } = await run(
      [mapStep('m', 0, 'agenda', { caseId: expression('event.caseId'), court: expression('event.caseId.court') })],
      { id: 'd1', caseId: null },
    );

    expect(outputs.m.agenda).toStrictEqual({ caseId: null, court: null });
  });

  it('referência múltipla: sozinha é a lista de ids, navegada colhe o campo de cada apontado', async () => {
    const { outputs, calls } = await run(
      [
        mapStep('m', 0, 'agenda', {
          calendars: expression('event.calendars'),
          first: expression('event.calendars[0]'),
          firstName: expression('event.calendars[0].name'),
          names: { kind: 'Event', path: 'calendars.name' },
          calendarsEvent: { kind: 'Event', path: 'calendars' },
        }),
      ],
      { id: 'd1', calendars: ['a1', 'a2'] },
    );

    expect(outputs.m.agenda).toStrictEqual({
      calendars: ['a1', 'a2'],
      first: 'a1',
      firstName: 'Agenda A',
      names: ['Agenda A', 'Agenda B'],
      calendarsEvent: ['a1', 'a2'],
    });
    expect(calls).toStrictEqual(['calendars:a1,a2']);
  });

  it('o espelho do prazo na agenda grava caseId e personId como texto, mesmo com o tribunal navegado no título', async () => {
    const { repository } = await run(
      [
        mapStep('m', 0, 'evento', {
          title: expression('concat(event.title, " - ", event.caseId.court)'),
          caseId: expression('event.caseId'),
          personId: expression('event.responsibleLawyerId'),
        }),
        {
          id: 'u',
          stepDefinitionId: 'upsert',
          type: 'Action',
          order: 1,
          enabled: true,
          configuration: { upsert: { kind: 'Literal', value: { table: 'calendarEvents', source: 'input', property: 'evento' } } },
        },
      ],
      { id: 'd1', title: 'Contestação', caseId: 'k1', responsibleLawyerId: 'p1' },
    );

    expect(repository.written).toHaveLength(1);
    expect(repository.written[0].collection).toBe('calendarEvents');
    expect(repository.written[0].data).toMatchObject({ title: 'Contestação - TJBA', caseId: 'k1', personId: 'p1' });
  });

  it('quem lê o payload inteiro recebe os ids, mesmo com a referência navegada noutro passo', async () => {
    const { repository } = await run(
      [
        mapStep('m', 0, 'tribunal', { court: expression('event.caseId.court') }),
        {
          id: 'u',
          stepDefinitionId: 'upsert',
          type: 'Action',
          order: 1,
          enabled: true,
          configuration: { upsert: { kind: 'Literal', value: { table: 'calendarEvents', source: 'event' } } },
        },
      ],
      { title: 'Contestação', caseId: 'k1' },
    );

    expect(repository.written[0].data).toMatchObject({ title: 'Contestação', caseId: 'k1' });
  });
});
