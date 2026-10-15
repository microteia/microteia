import { describe, it, expect } from 'vitest';
import { WorkflowContextHydrator, createHydrationCache } from './WorkflowContextHydrator';
import type { IWorkflowRecordFetcher } from '../repositories/IWorkflowRecordFetcher';
import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import type { SchemaScreen } from '../schema/pathResolver';
import type { WorkflowDefinition, WorkflowEvent } from '../entities/Workflow';
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
