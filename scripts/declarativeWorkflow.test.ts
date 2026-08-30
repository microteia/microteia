import { describe, expect, it } from 'vitest';
import { runWorkflow } from '../functions/src/domain/engine/WorkflowExecutor';
import { makeMapStepDefinition } from '../functions/src/infrastructure/workflow/steps/MapStep';
import { makeExitStepDefinition } from '../functions/src/infrastructure/workflow/steps/ExitStep';
import { makeQueryStepDefinition } from '../functions/src/infrastructure/workflow/steps/QueryStep';
import { makeUpsertStepDefinition } from '../functions/src/infrastructure/workflow/steps/UpsertStep';
import { makeRemoveStepDefinition } from '../functions/src/infrastructure/workflow/steps/RemoveStep';
import { fakeScreenProvider } from '../functions/src/domain/repositories/fakeScreenProvider';
import type { StepRegistry } from '../functions/src/domain/engine/StepRegistry';
import type { WorkflowServices } from '../functions/src/domain/entities/WorkflowContext';
import type { WorkflowDefinition, WorkflowStep } from '../functions/src/domain/entities/Workflow';
import type { SchemaScreen } from '../functions/src/domain/schema/pathResolver';
import { MARKETPLACE_CATALOG, automationExamplePlugin } from '../src/plugins/marketplace/catalog';

/**
 * Uma declaração escrita à mão rodando no MOTOR de verdade, com um banco em memória que grava.
 *
 * Este teste mora em `scripts/` porque é o único lugar que enxerga as duas pontas: a forma de uma tela
 * e de um workflow vive em `src/`, o motor que os executa vive em `functions/`, e os dois projetos não
 * compartilham código. Nenhum teste de dentro de um deles alcança a pergunta que interessa aqui — um id
 * de passo errado, um caminho de expressão errado (`output.buscarItem.first.id`), um `QuerySpec` ou um
 * `UpsertSpec` com o campo trocado. Todos esses compilam, e nenhum falha até alguém executar o fluxo.
 *
 * A declaração é DE PROPÓSITO agnóstica de negócio: `records` e `mirror`, sem uma palavra de domínio.
 * Ela substitui três testes que provavam a mesma coisa com prazo, processo e lançamento financeiro —
 * extensões que hoje são mantidas fora deste repositório. O que o kernel tem de garantir é que a
 * MECÂNICA executa; quem responde pelo vocabulário é quem o declara.
 *
 * A forma exercitada é a do espelho, que é a mais exigente que a plataforma oferece: perguntar se o
 * espelho já existe, ramificar sobre a resposta, montar o objeto e gravá-lo — e a mesma coisa em
 * repetição, sobre uma lista. Daí sai a única propriedade que uma declaração não consegue afirmar sobre
 * si mesma: **rodar de novo não duplica nada**.
 */

const SOURCE: SchemaScreen = {
  id: 'records',
  collection: 'records',
  titleSingular: 'Record',
  titlePlural: 'Records',
  titleFieldKey: 'title',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, order: 0, origin: 'plugin' },
    { key: 'state', label: 'State', type: 'text', required: false, order: 1, origin: 'plugin' },
    { key: 'amount', label: 'Amount', type: 'number', required: false, order: 2, origin: 'plugin' },
  ],
};

const MIRROR: SchemaScreen = {
  id: 'mirror',
  collection: 'mirror',
  titleSingular: 'Mirror item',
  titlePlural: 'Mirror items',
  titleFieldKey: 'title',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, order: 0, origin: 'plugin' },
    { key: 'state', label: 'State', type: 'text', required: false, order: 1, origin: 'plugin' },
    { key: 'amount', label: 'Amount', type: 'number', required: false, order: 2, origin: 'plugin' },
    { key: 'originId', label: 'Origin', type: 'text', required: false, order: 3, origin: 'plugin' },
  ],
};

const screenProvider = fakeScreenProvider([SOURCE, MIRROR]);

const services: WorkflowServices = {
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  now: () => new Date('2026-08-20T09:00:00Z'),
};

interface Row {
  id: string;
  data: Record<string, unknown>;
}

/**
 * Um banco em memória que grava de verdade. Sem ele a segunda execução não teria como encontrar o que a
 * primeira criou, e a pergunta sobre duplicação ficaria sem resposta.
 */
const banco = (inicial: Record<string, Row[]>) => {
  const rows: Record<string, Row[]> = {};
  for (const [collection, items] of Object.entries(inicial)) {
    rows[collection] = items.map((item) => ({ id: item.id, data: { ...item.data } }));
  }
  let sequencia = 0;

  const listOf = (collection: string): Row[] => {
    rows[collection] ??= [];
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

  return { registry, espelho: () => listOf('mirror'), origem: () => listOf('records') };
};

// ─── A declaração ─────────────────────────────────────────────────────────────
//
// Escrita como uma extensão a escreveria: `stepDefinitionId` por nome, mapeamentos por `kind`, e os
// caminhos de expressão sobre o contexto (`event.*`, `output.*`).

/**
 * "Já existe espelho para esta origem?" — a pergunta que torna o fluxo IDEMPOTENTE, e a razão de ela
 * precisar de DOIS passos. Os dois ramos publicam a MESMA chave (`input.itemId`): o passo que monta o
 * objeto não sabe por qual caminho o fluxo passou, e o `Gravar Registro` inclui quando ela é nula e
 * atualiza quando não é. Ler `output.<busca>.first.id` direto pareceria mais curto e quebraria na
 * primeira execução — sem espelho, `first` é nulo, e a expressão falha.
 */
const acharEspelho = (busca: string, order: number, originExpression: string): WorkflowStep[] => [
  {
    id: busca,
    stepDefinitionId: 'query',
    type: 'Action',
    order,
    enabled: true,
    configuration: {
      query: {
        kind: 'Literal',
        value: {
          table: 'mirror',
          where: [{ path: 'originId', op: 'eq', value: { kind: 'Expression', expression: originExpression } }],
          orderBy: [],
          limit: 1,
          projections: [],
        },
      },
    },
  },
  {
    id: `${busca}Existe`,
    stepDefinitionId: '',
    type: 'Condition',
    order: order + 1,
    enabled: true,
    condition: { kind: 'Expression', expression: `output.${busca}.count < 1` },
    configuration: {},
    branches: {
      whenTrue: [publicarItemId(`${busca}Sem`, 0, null)],
      whenFalse: [publicarItemId(`${busca}Com`, 0, `output.${busca}.first.id`)],
    },
  },
];

/** `name: ''` espalha os campos na RAIZ do contexto — é assim que `input.itemId` passa a existir. */
const publicarItemId = (id: string, order: number, expression: string | null): WorkflowStep => ({
  id,
  stepDefinitionId: 'map',
  type: 'Action',
  order,
  enabled: true,
  configuration: {
    map: {
      kind: 'Literal',
      value: {
        name: '',
        fields: [
          {
            name: 'itemId',
            value: expression === null
              ? { kind: 'Literal', value: null }
              : { kind: 'Expression', expression },
          },
        ],
      },
    },
  },
});

/**
 * O objeto que vai ser gravado, sob o nome `item`. O primeiro campo é o `id`: é ele que o
 * `Gravar Registro` lê para decidir entre incluir e atualizar.
 */
const montarItem = (id: string, order: number, sourceExpression: string): WorkflowStep => ({
  id,
  stepDefinitionId: 'map',
  type: 'Action',
  order,
  enabled: true,
  configuration: {
    map: {
      kind: 'Literal',
      value: {
        name: 'item',
        fields: [
          { name: 'id', value: { kind: 'Expression', expression: 'input.itemId' } },
          { name: 'title', value: { kind: 'Expression', expression: `${sourceExpression}.title` } },
          { name: 'state', value: { kind: 'Expression', expression: `${sourceExpression}.state` } },
          { name: 'amount', value: { kind: 'Expression', expression: `${sourceExpression}.amount` } },
          { name: 'originId', value: { kind: 'Expression', expression: `${sourceExpression}.id` } },
        ],
      },
    },
  },
});

const gravarItem = (id: string, order: number): WorkflowStep => ({
  id,
  stepDefinitionId: 'upsert',
  type: 'Action',
  order,
  enabled: true,
  configuration: {
    upsert: { kind: 'Literal', value: { table: 'mirror', source: 'input', property: 'item' } },
  },
});

const SYNC: WorkflowStep[] = [
  ...acharEspelho('buscarItem', 0, 'event.id'),
  montarItem('montarItem', 2, 'event'),
  gravarItem('gravarItem', 3),
];

const REMOVE: WorkflowStep[] = [
  {
    id: 'buscarItem',
    stepDefinitionId: 'query',
    type: 'Action',
    order: 0,
    enabled: true,
    configuration: {
      query: {
        kind: 'Literal',
        value: {
          table: 'mirror',
          where: [{ path: 'originId', op: 'eq', value: { kind: 'Expression', expression: 'event.id' } }],
          orderBy: [],
          limit: 1,
          projections: [],
        },
      },
    },
  },
  {
    id: 'itemExiste',
    stepDefinitionId: '',
    type: 'Condition',
    order: 1,
    enabled: true,
    condition: { kind: 'Expression', expression: 'output.buscarItem.count < 1' },
    configuration: {},
    branches: {
      whenTrue: [
        { id: 'semItemSair', stepDefinitionId: 'exit', type: 'Action', order: 0, enabled: true, configuration: {} },
      ],
      whenFalse: [],
    },
  },
  {
    id: 'excluirItem',
    stepDefinitionId: 'remove',
    type: 'Action',
    order: 2,
    enabled: true,
    configuration: {
      remove: {
        kind: 'Literal',
        value: {
          table: 'mirror',
          id: { kind: 'Expression', expression: 'output.buscarItem.first.id' },
        },
      },
    },
  },
];

/** O mutirão: a mesma pergunta e a mesma gravação, agora sobre uma lista, dentro de uma repetição. */
const SWEEP: WorkflowStep[] = [
  {
    id: 'buscarOrigem',
    stepDefinitionId: 'query',
    type: 'Action',
    order: 0,
    enabled: true,
    configuration: {
      query: {
        kind: 'Literal',
        value: {
          table: 'records',
          where: [{ path: 'state', op: 'eq', value: { kind: 'Expression', expression: 'event.state' } }],
          orderBy: [],
          limit: 100,
          projections: [],
        },
      },
    },
  },
  {
    id: 'cadaRegistro',
    stepDefinitionId: '',
    type: 'Loop',
    order: 1,
    enabled: true,
    configuration: {},
    loop: {
      source: { kind: 'Expression', expression: 'output.buscarOrigem.results' },
      itemName: 'registro',
      outputName: 'itens',
      // Dentro do corpo, o registro da vez é `output.cadaRegistro` — o nó de repetição publica o item
      // corrente sob a própria chave, e as saídas do corpo são zeradas a cada volta.
      body: [
        ...acharEspelho('buscarItem', 0, 'output.cadaRegistro.id'),
        montarItem('montarItem', 2, 'output.cadaRegistro'),
        gravarItem('gravarItem', 3),
      ],
    },
  },
  {
    id: 'responder',
    stepDefinitionId: 'map',
    type: 'Action',
    order: 2,
    enabled: true,
    configuration: {
      map: {
        kind: 'Literal',
        value: {
          name: '',
          fields: [
            { name: 'sincronizados', value: { kind: 'Expression', expression: 'output.buscarOrigem.count' } },
          ],
        },
      },
    },
  },
];

const definitionOf = (steps: WorkflowStep[], eventName: string): WorkflowDefinition => ({
  id: 'wf-teste',
  tenantId: 't1',
  name: 'espelho',
  eventName,
  version: 1,
  enabled: true,
  condition: { kind: 'AlwaysTrue' },
  steps,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as WorkflowDefinition);

const rodar = (
  registry: StepRegistry,
  steps: WorkflowStep[],
  eventName: string,
  payload: Record<string, unknown>,
) => runWorkflow({
  definition: definitionOf(steps, eventName),
  event: { id: 'evt1', tenantId: 't1', name: eventName, payload, createdAt: new Date() },
  registry,
  services,
});

const REGISTROS: Row[] = [
  { id: 'r-1', data: { title: 'Primeiro', state: 'open', amount: 10 } },
  { id: 'r-2', data: { title: 'Segundo', state: 'open', amount: 20 } },
  { id: 'r-3', data: { title: 'Terceiro', state: 'closed', amount: 30 } },
];

describe('o espelho declarado, rodando no motor', () => {
  it('cria o item na primeira gravação, com os campos que a declaração monta', async () => {
    const { registry, espelho } = banco({ records: REGISTROS, mirror: [] });

    const execution = await rodar(registry, SYNC, 'record.saved', {
      id: 'r-1', title: 'Primeiro', state: 'open', amount: 10,
    });

    expect(execution.status).toBe('SUCCESS');
    expect(espelho()).toHaveLength(1);
    expect(espelho()[0].data).toMatchObject({
      title: 'Primeiro', state: 'open', amount: 10, originId: 'r-1',
    });
  });

  /**
   * A propriedade central, e a única que a declaração não afirma sobre si mesma: ela EMERGE da pergunta
   * que o fluxo faz antes de gravar. Um teste sobre a forma da declaração não a alcançaria.
   */
  it('rodar de novo ATUALIZA o mesmo item, em vez de criar outro', async () => {
    const { registry, espelho } = banco({ records: REGISTROS, mirror: [] });
    const payload = { id: 'r-1', title: 'Primeiro', state: 'open', amount: 10 };

    await rodar(registry, SYNC, 'record.saved', payload);
    await rodar(registry, SYNC, 'record.saved', { ...payload, title: 'Primeiro (revisado)', state: 'closed' });

    expect(espelho()).toHaveLength(1);
    expect(espelho()[0].data).toMatchObject({ title: 'Primeiro (revisado)', state: 'closed' });
  });

  it('a exclusão retira o item, e sem item o fluxo encerra sem erro', async () => {
    const { registry, espelho } = banco({ records: REGISTROS, mirror: [] });
    await rodar(registry, SYNC, 'record.saved', { id: 'r-1', title: 'Primeiro', state: 'open', amount: 10 });

    expect(await rodar(registry, REMOVE, 'record.deleted', { id: 'r-1' })).toMatchObject({ status: 'SUCCESS' });
    expect(espelho()).toEqual([]);

    // De novo, agora sem item nenhum: o ramo de encerramento é o que impede a falha.
    expect(await rodar(registry, REMOVE, 'record.deleted', { id: 'r-1' })).toMatchObject({ status: 'SUCCESS' });
    expect(espelho()).toEqual([]);
  });

  /**
   * Um caminho de expressão errado é o erro mais provável de uma declaração escrita à mão — e o mais
   * silencioso: `output.buscarItem.first.id` compila igual escrito de qualquer jeito. Aqui ele resolve
   * ou o item vai para o lugar errado.
   */
  it('o caminho da consulta anterior resolve: o item novo não reaproveita o id de outro', async () => {
    const { registry, espelho } = banco({ records: REGISTROS, mirror: [] });

    await rodar(registry, SYNC, 'record.saved', { id: 'r-1', title: 'Primeiro', state: 'open', amount: 10 });
    await rodar(registry, SYNC, 'record.saved', { id: 'r-2', title: 'Segundo', state: 'open', amount: 20 });

    expect(espelho()).toHaveLength(2);
    expect(espelho().map((row) => row.data.originId).sort()).toEqual(['r-1', 'r-2']);
  });
});

describe('o mutirão declarado, rodando no motor', () => {
  it('espelha a fatia escolhida, e só ela', async () => {
    const { registry, espelho } = banco({ records: REGISTROS, mirror: [] });

    const execution = await rodar(registry, SWEEP, 'workflow.called', { state: 'open' });

    expect(execution.status).toBe('SUCCESS');
    expect(execution.outputs).toMatchObject({ sincronizados: 2 });
    expect(espelho().map((row) => row.data.originId).sort()).toEqual(['r-1', 'r-2']);
  });

  it('e rodar de novo não duplica nada — cada origem tem no máximo um item', async () => {
    const { registry, espelho } = banco({ records: REGISTROS, mirror: [] });

    await rodar(registry, SWEEP, 'workflow.called', { state: 'open' });
    await rodar(registry, SWEEP, 'workflow.called', { state: 'open' });

    expect(espelho()).toHaveLength(2);
  });

  /** O mutirão e o gatilho gravam o MESMO item: quem já passou por um não ganha um segundo pelo outro. */
  it('o mutirão reconhece o item que o gatilho já havia criado', async () => {
    const { registry, espelho } = banco({ records: REGISTROS, mirror: [] });

    await rodar(registry, SYNC, 'record.saved', { id: 'r-1', title: 'Primeiro', state: 'open', amount: 10 });
    await rodar(registry, SWEEP, 'workflow.called', { state: 'open' });

    expect(espelho()).toHaveLength(2);
    expect(espelho().filter((row) => row.data.originId === 'r-1')).toHaveLength(1);
  });

  it('lista vazia não grava nada e o fluxo termina em sucesso', async () => {
    const { registry, espelho } = banco({ records: REGISTROS, mirror: [] });

    const execution = await rodar(registry, SWEEP, 'workflow.called', { state: 'nao-existe' });

    expect(execution.status).toBe('SUCCESS');
    expect(espelho()).toEqual([]);
  });

  /**
   * O `upsert` DESCARTA caminho não declarado na tela alvo. É por isso que o objeto montado aqui leva um
   * campo a mais: se o descarte deixasse de acontecer, o espelho passaria a gravar o que a tela não
   * conhece — e um dado que a tela não conhece é um dado que ninguém consegue corrigir depois.
   *
   * `createdBy` e `updatedBy` são carimbo do motor, não da declaração, e por isso estão na conta.
   */
  it('grava só o que a tela alvo declara, mais o carimbo do motor', async () => {
    const { registry, espelho } = banco({ records: REGISTROS, mirror: [] });
    await rodar(registry, SYNC, 'record.saved', {
      id: 'r-1', title: 'Primeiro', state: 'open', amount: 10, naoDeclarado: 'ignorar',
    });

    expect(Object.keys(espelho()[0].data).sort())
      .toEqual(['amount', 'createdBy', 'originId', 'state', 'title', 'updatedBy']);
  });
});

/**
 * O MESMO valor é endereçado de três jeitos diferentes num workflow, e confundi-los é o erro mais
 * comum que existe aqui: o `fieldPath` de uma condição é ABSOLUTO sobre o contexto inteiro
 * (`event.payload.x`), o `path` de um mapping `Event` é RELATIVO ao payload (`x`), e dentro de uma
 * Expression o nome `event` JÁ É o payload (`event.x`).
 *
 * Esta é a ponta que não tinha rede. `event.payload.x` numa Expression não lê vazio: o acesso a
 * membro sobre `undefined` ESTOURA, o passo falha ao resolver o input e o fluxo inteiro para — e nada
 * dizia isso antes de alguém gravar um registro. Foi assim que o exemplo canônico de automação
 * viajou com as duas mensagens de auditoria quebradas, nos dois ramos, escritas exatamente como a
 * documentação do MCP mandava escrever.
 */
const mapearMensagem = (expression: string): WorkflowStep[] => [{
  id: 'mensagem',
  stepDefinitionId: 'map',
  type: 'Action',
  order: 0,
  enabled: true,
  configuration: {
    map: {
      kind: 'Literal',
      value: { name: 'mensagem', fields: [{ name: 'texto', value: { kind: 'Expression', expression } }] },
    },
  },
}];

describe('numa Expression, `event` é o próprio payload', () => {
  it('`event.title` resolve o campo do registro', async () => {
    const { registry } = banco({ records: [], mirror: [] });
    const execucao = await rodar(registry, mapearMensagem('concat("Aberto: ", event.title)'), 'record.saved', {
      id: 'r-1', title: 'Primeiro',
    });

    expect(execucao.status).toBe('SUCCESS');
    expect(execucao.outputs?.mensagem).toEqual({ texto: 'Aberto: Primeiro' });
  });

  it('`event.payload.title` derruba a execução, em vez de ler vazio', async () => {
    const { registry } = banco({ records: [], mirror: [] });
    const execucao = await rodar(registry, mapearMensagem('concat("Aberto: ", event.payload.title)'), 'record.saved', {
      id: 'r-1', title: 'Primeiro',
    });

    expect(execucao.status).toBe('FAILED');
  });
});

/** Toda expressão declarada nos workflows de um pacote, ramos e repetições inclusive. */
const expressoesDe = (node: unknown, encontradas: string[] = []): string[] => {
  if (Array.isArray(node)) {
    node.forEach((item) => expressoesDe(item, encontradas));
    return encontradas;
  }
  if (node === null || typeof node !== 'object') return encontradas;

  const record = node as Record<string, unknown>;
  if (record.kind === 'Expression' && typeof record.expression === 'string') {
    encontradas.push(record.expression);
  }
  if (record.kind === 'FieldComparison' && record.valueType === 'expression') {
    encontradas.push(String(record.value));
  }
  Object.values(record).forEach((value) => expressoesDe(value, encontradas));
  return encontradas;
};

const PACOTES_COM_WORKFLOW = [...MARKETPLACE_CATALOG, automationExamplePlugin]
  .filter((plugin) => (plugin.workflows ?? []).length > 0);

describe('as declarações de primeira parte endereçam o evento como o motor o expõe', () => {
  it('há pacote com workflow para conferir', () => {
    expect(PACOTES_COM_WORKFLOW.length).toBeGreaterThan(0);
  });

  it.each(PACOTES_COM_WORKFLOW.map((plugin) => [plugin.manifest.id, plugin] as const))(
    '%s: nenhuma Expression pede `event.payload`',
    (_id, plugin) => {
      const erradas = expressoesDe(plugin.workflows).filter((expression) => expression.includes('event.payload'));
      expect(erradas, 'numa Expression o `event` já é o payload — escreva `event.campo`').toEqual([]);
    },
  );
});
