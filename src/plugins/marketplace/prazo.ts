import type {
  ActionModuleTemplate,
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  ScreenPatchTemplate,
  TemplateField,
  WorkflowModuleTemplate,
} from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption } from '../../domain/entities';
import type { Condition, WorkflowStep } from '../../domain/entities/Workflow';
import { nav, page, pointContribution, surfaceWidget } from '../contributionBuilders';

/**
 * **Prazos** — o controle de prazos do escritório, inteiro, declarado por extensão: campos, listas de
 * opções, o cartão da listagem, a ordem em que a lista se lê, os filtros e o prefixo dos eventos.
 *
 * `dataCollection: 'deadlines'` aponta para a coleção onde os prazos já estão — nada se move, e os
 * eventos (`deadline.saved`) que as automações escutam seguem com o mesmo nome.
 *
 * O que ANTES era código do kernel e agora é declaração: o botão "marcar como concluído" virou uma
 * **Action** sobre um workflow, com a expressão que decide quando ele aparece; a prioridade e o
 * status, que eram uniões fechadas no tipo, viraram listas de opções do escritório; a ordem da
 * lista (do vencimento mais próximo ao mais distante) virou o comparador que a listagem recebe; e o
 * Step "Criar Prazo" do motor virou um WORKFLOW da própria extensão.
 */
const SOURCE_ID = 'microteia:prazo';

const IDENTIFICACAO = 'Identificação';
const DATAS = 'Datas';
const DETALHES = 'Responsável e Detalhes';

const FIELDS: TemplateField[] = [
  { key: 'type', label: 'Tipo', type: 'select', required: true, order: 0, section: IDENTIFICACAO, lookupCollection: 'deadlineTypes', optionsAllowUserAdd: true, filterable: true, placeholder: 'Selecione o tipo...' },
  { key: 'priority', label: 'Prioridade', type: 'select', required: true, order: 1, section: IDENTIFICACAO, lookupCollection: 'deadlinePriorities', optionsColored: true, filterable: true, placeholder: 'Selecione a prioridade...' },
  { key: 'status', label: 'Status', type: 'select', required: true, order: 2, section: IDENTIFICACAO, lookupCollection: 'deadlineStatuses', optionsColored: true, filterable: true, placeholder: 'Selecione o status...' },
  { key: 'caseId', label: 'Processo', type: 'reference', required: true, order: 3, section: IDENTIFICACAO, refEntity: 'cases', placeholder: 'Selecione o processo...', filterable: true, showInList: true, listIcon: 'folder', listOrder: 0 },
  { key: 'dueDate', label: 'Data de vencimento', type: 'date', required: true, order: 4, section: DATAS, filterable: true, showInList: true, listIcon: 'calendar', listOrder: 1 },
  { key: 'completedAt', label: 'Data de conclusão', type: 'date', required: false, order: 5, section: DATAS, filterable: true, showInList: true, listIcon: 'calendarCheck', listOrder: 2 },
  { key: 'responsibleLawyerId', label: 'Advogado responsável', type: 'reference', required: false, order: 6, section: DETALHES, refEntity: 'persons', placeholder: 'Selecione o responsável...', filterable: true, showInList: true, listIcon: 'scales', listOrder: 3 },
  { key: 'description', label: 'Descrição', type: 'textarea', required: false, order: 7, section: DETALHES, placeholder: 'Detalhes sobre o prazo, documentos necessários, etc.', showInList: true, listIcon: 'fileText', listOrder: 4 },
];

const opts = (labels: string[]): CustomFieldOption[] => labels.map((label) => ({ key: label, label }));

const colored = (entries: [string, string][]): CustomFieldOption[] =>
  entries.map(([label, color]) => ({ key: label, label, color }));

/**
 * As listas com as opções de PARTIDA — semeadas só quando a lista está vazia no escritório; dali em
 * diante são dele. As chaves de prioridade e status são os RÓTULOS que os prazos já guardam
 * ("Pendente", "Crítica"): a lista descreve o que está gravado, não um esquema novo.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: 'deadlineTypes',
    label: 'Prazo: Tipo',
    options: opts(['Audiência', 'Recurso', 'Contestação', 'Petição', 'Pagamento', 'Outro']),
  },
  {
    collection: 'deadlinePriorities',
    label: 'Prazo: Prioridade',
    options: colored([['Baixa', 'success'], ['Média', 'warning'], ['Alta', 'secondary'], ['Crítica', 'danger']]),
  },
  {
    collection: 'deadlineStatuses',
    label: 'Prazo: Status',
    options: colored([['Pendente', 'info'], ['Concluído', 'success'], ['Vencido', 'danger'], ['Cancelado', 'textSecondary']]),
  },
];

/**
 * Concluir um prazo era um `if` na view seguido de uma chamada de store. Agora são três passos
 * declarados — Montar Objeto com o que muda → Gravar Registro → resposta com `actions: ['refresh']` —
 * e uma Action que diz QUANDO o gesto aparece, por expressão sobre o próprio registro.
 */
const CONCLUIR_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-prazo-concluir',
  name: 'Marcar prazo como concluído',
  description: 'Marca o prazo como Concluído e carimba a data de conclusão de hoje.',
  eventName: 'workflow.called',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [
    {
      id: 'montar',
      stepDefinitionId: 'map',
      type: 'Action',
      order: 0,
      enabled: true,
      configuration: {
        map: {
          kind: 'Literal',
          value: {
            name: 'prazo',
            fields: [
              { name: 'id', value: { kind: 'Expression', expression: 'event.recordId' } },
              { name: 'status', value: { kind: 'Literal', value: 'Concluído' } },
              { name: 'completedAt', value: { kind: 'Expression', expression: 'today()' } },
            ],
          },
        },
      },
    },
    {
      id: 'gravar',
      stepDefinitionId: 'upsert',
      type: 'Action',
      order: 1,
      enabled: true,
      configuration: {
        upsert: { kind: 'Literal', value: { table: 'deadlines', source: 'input', property: 'prazo' } },
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
              { name: 'status', value: { kind: 'Literal', value: 'Prazo marcado como concluído.' } },
              { name: 'actions', value: { kind: 'Literal', value: ['refresh'] } },
            ],
          },
        },
      },
    },
  ],
};

/**
 * **Criar Prazo** — o que era o Step `create-deadline` do kernel, agora como workflow chamável da
 * própria extensão. A diferença não é só de forma: o Step exigia o **id** do processo e o do
 * advogado, e quem chama um workflow raramente os tem em mãos — quem analisa uma intimação tem o
 * NÚMERO do processo e o NOME do advogado.
 *
 * Por isso o workflow resolve os dois antes de gravar, e **para** quando não acha: um prazo pendurado
 * num processo inexistente é pior do que um erro na cara de quem chamou. O advogado é opcional; o
 * processo, não.
 *
 * O caminho de erro é sempre o mesmo par — Montar Objeto com `{ ok: false, error }` e Encerrar
 * Workflow —, porque o Encerrar não produz saída própria: o retorno do workflow é a saída do passo
 * anterior a ele.
 */
const erro = (id: string, order: number, expression: string): WorkflowStep[] => [
  {
    id: `${id}Mensagem`,
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
            { name: 'ok', value: { kind: 'Literal', value: false } },
            { name: 'error', value: { kind: 'Expression', expression } },
          ],
        },
      },
    },
  },
  {
    id: `${id}Sair`,
    stepDefinitionId: 'exit',
    type: 'Action',
    order: order + 1,
    enabled: true,
    configuration: {},
  },
];

/**
 * O valor de um filtro vai como EXPRESSÃO, e não como `{ kind: 'Event' }`, embora o motor resolva os
 * dois: o construtor de consulta do Form Design só oferece "Valor fixo" e "Expressão". Um mapping
 * `Event` roda, mas aparece ali como "Valor fixo" **vazio** — o escritório abriria a automação
 * instalada e leria uma mentira, e o primeiro toque na linha apagaria o filtro. Declaração que a
 * autoria não sabe reabrir é declaração quebrada, ainda que execute.
 */
const buscar = (id: string, order: number, table: string, path: string, expression: string): WorkflowStep => ({
  id,
  stepDefinitionId: 'query',
  type: 'Action',
  order,
  enabled: true,
  configuration: {
    query: {
      kind: 'Literal',
      value: {
        table,
        where: [{ path, op: 'eq', value: { kind: 'Expression', expression } }],
        limit: 1,
        projections: [],
      },
    },
  },
});

/**
 * "Não achou nada" é uma EXPRESSÃO, não uma comparação de campo. A comparação lê o caminho contra o
 * contexto inteiro — `outputs.buscarProcesso.count` funciona —, mas o seletor de campo dela só
 * oferece os campos do EVENTO: o caminho aparece marcado em vermelho, como se estivesse errado.
 * O nó de expressão do mesmo construtor já autocompleta `output.` (as saídas dos steps anteriores),
 * que é onde essa informação mora. Note o singular: a comparação enxerga o contexto cru (`outputs`),
 * a expressão enxerga o escopo publicado para ela (`output`).
 */
const naoEncontrou = (stepId: string): Condition => ({
  kind: 'Expression',
  expression: `output.${stepId}.count < 1`,
});

const CRIAR_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-prazo-criar',
  name: 'Criar Prazo',
  description: 'Cria um prazo a partir do NÚMERO do processo e do NOME do advogado responsável, resolvendo os dois antes de gravar. Encerra com erro se o processo não existir, ou se o advogado informado não for encontrado.',
  eventName: 'workflow.called',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  parameters: [
    { key: 'caseNumber', label: 'Número do processo', type: 'String', required: true },
    // As mesmas listas do formulário de prazo, e não uma cópia das opções: o que o escritório
    // acrescentar na tela aparece aqui no mesmo instante.
    { key: 'type', label: 'Tipo de prazo', type: 'lookup', lookupCollection: 'deadlineTypes', required: true, defaultValue: 'Petição' },
    { key: 'dueDate', label: 'Data de vencimento', type: 'Date', required: true },
    { key: 'priority', label: 'Prioridade', type: 'lookup', lookupCollection: 'deadlinePriorities', required: false, defaultValue: 'Média' },
    { key: 'description', label: 'Descrição', type: 'String', required: false },
    { key: 'responsibleLawyerName', label: 'Advogado responsável (nome exato)', type: 'String', required: false },
  ],
  steps: [
    buscar('buscarProcesso', 0, 'cases', 'caseNumber', 'event.caseNumber'),
    {
      id: 'processoEncontrado',
      stepDefinitionId: '',
      type: 'Condition',
      order: 1,
      enabled: true,
      condition: naoEncontrou('buscarProcesso'),
      configuration: {},
      branches: {
        whenTrue: erro('processo', 0, 'concat("Processo ", event.caseNumber, " não encontrado.")'),
        whenFalse: [],
      },
    },
    {
      id: 'advogadoInformado',
      stepDefinitionId: '',
      type: 'Condition',
      order: 2,
      enabled: true,
      condition: {
        kind: 'FieldComparison',
        fieldPath: 'event.payload.responsibleLawyerName',
        operator: 'isNotEmpty',
        value: null,
        valueType: 'literal',
      },
      configuration: {},
      branches: {
        whenTrue: [
          buscar('buscarAdvogado', 0, 'persons', 'name', 'event.responsibleLawyerName'),
          {
            id: 'advogadoEncontrado',
            stepDefinitionId: '',
            type: 'Condition',
            order: 1,
            enabled: true,
            condition: naoEncontrou('buscarAdvogado'),
            configuration: {},
            branches: {
              whenTrue: erro('advogado', 0, 'concat("Advogado \\"", event.responsibleLawyerName, "\\" não encontrado.")'),
              whenFalse: [],
            },
          },
          // Os dois ramos publicam a MESMA chave: o passo que monta o prazo lê `input.responsibleLawyerId`
          // sem saber por qual caminho o fluxo passou.
          {
            id: 'advogadoResolvido',
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
                    { name: 'responsibleLawyerId', value: { kind: 'Expression', expression: 'output.buscarAdvogado.first.id' } },
                  ],
                },
              },
            },
          },
        ],
        whenFalse: [
          {
            id: 'semAdvogado',
            stepDefinitionId: 'map',
            type: 'Action',
            order: 0,
            enabled: true,
            configuration: {
              map: {
                kind: 'Literal',
                value: {
                  name: '',
                  fields: [
                    { name: 'responsibleLawyerId', value: { kind: 'Literal', value: null } },
                  ],
                },
              },
            },
          },
        ],
      },
    },
    {
      id: 'montarPrazo',
      stepDefinitionId: 'map',
      type: 'Action',
      order: 3,
      enabled: true,
      configuration: {
        map: {
          kind: 'Literal',
          value: {
            name: 'prazo',
            fields: [
              { name: 'caseId', value: { kind: 'Expression', expression: 'output.buscarProcesso.first.id' } },
              { name: 'type', value: { kind: 'Event', path: 'type' } },
              { name: 'dueDate', value: { kind: 'Event', path: 'dueDate' } },
              { name: 'priority', value: { kind: 'Event', path: 'priority' } },
              { name: 'description', value: { kind: 'Event', path: 'description' } },
              { name: 'responsibleLawyerId', value: { kind: 'Expression', expression: 'input.responsibleLawyerId' } },
              // Nasce pendente, sempre. "Vencido" é situação derivada da data, e é a listagem que a
              // pinta — carimbá-la aqui congelaria no registro algo que muda sozinho amanhã.
              { name: 'status', value: { kind: 'Literal', value: 'Pendente' } },
              { name: 'completedAt', value: { kind: 'Literal', value: null } },
            ],
          },
        },
      },
    },
    {
      id: 'gravarPrazo',
      stepDefinitionId: 'upsert',
      type: 'Action',
      order: 4,
      enabled: true,
      configuration: {
        upsert: { kind: 'Literal', value: { table: 'deadlines', source: 'input', property: 'prazo' } },
      },
    },
    {
      id: 'responder',
      stepDefinitionId: 'map',
      type: 'Action',
      order: 5,
      enabled: true,
      configuration: {
        map: {
          kind: 'Literal',
          value: {
            name: '',
            fields: [
              { name: 'ok', value: { kind: 'Literal', value: true } },
              { name: 'deadlineId', value: { kind: 'Expression', expression: 'output.gravarPrazo.id' } },
              { name: 'status', value: { kind: 'Literal', value: 'Prazo criado.' } },
            ],
          },
        },
      },
    },
  ],
};

/**
 * ─── O prazo na AGENDA ────────────────────────────────────────────────────────────────────────
 *
 * O Calendário não sabe o que é um prazo, e não vai saber: ele apresenta itens de uma entidade
 * própria (`calendar`), e quem põe um item lá continua dono dele. Toda a integração abaixo é do
 * Prazo, e cabe em quatro peças:
 *
 * | Peça | O que faz |
 * |---|---|
 * | complemento de tela | acrescenta ao item do calendário o processo e a pessoa — que viram filtro |
 * | dois workflows de espelho | `deadline.saved` mantém o item em dia, `deadline.deleted` o remove |
 * | duas actions | concluir pelo cartão, e remarcar ao arrastar para outro dia |
 * | duas contribuições | dizem à agenda que estes gestos existem para itens de origem `deadlines` |
 *
 * O par que endereça o prazo é `origem: 'deadlines'` + `origemId`. É por ele que o clique no cartão
 * abre o prazo, que a sincronização encontra o item a atualizar, e que a agenda escolhe QUEM
 * responde ao arrasto — sem que nenhuma das duas pontas conheça a outra por dentro.
 */
const CALENDAR_SOURCE_ID = 'microteia:calendar';
const CALENDAR_COLLECTION = 'calendar';

/**
 * O que o Prazo acrescenta ao item do calendário. Os dois campos são `filterable`: é assim que a
 * agenda ganha o filtro por processo e por advogado sem ter uma linha sobre nenhum dos dois — o
 * `CompositeFilter` dela é montado a partir dos campos que a TELA declara, e a tela é a soma do que
 * o Calendário trouxe com o que as extensões acrescentaram.
 */
const CALENDAR_PATCH: ScreenPatchTemplate = {
  target: CALENDAR_SOURCE_ID,
  targetKind: 'sourceId',
  // O gesto de concluir entra na MESMA lista que o escritório edita no Form Design da agenda ("Ações
  // do card na listagem"), e não num mecanismo paralelo: instalar já o deixa no cartão, e quem
  // quiser tirá-lo, reordená-lo ou pôr outro ao lado faz isso pela tela de sempre.
  cardActionIds: ['act-prazo-calendar-concluir'],
  fields: [
    { key: 'caseId', label: 'Processo', type: 'reference', required: false, order: 20, section: 'Processo', refEntity: 'cases', filterable: true, showInList: true, listIcon: 'folder', listOrder: 10 },
    { key: 'personId', label: 'Advogado responsável', type: 'reference', required: false, order: 21, section: 'Processo', refEntity: 'persons', filterable: true, showInList: true, listIcon: 'scales', listOrder: 11 },
  ],
};

/**
 * A situação e a prioridade do prazo são RÓTULOS do escritório ("Pendente", "Crítica"); as do
 * calendário são chaves estáveis (`pending`, `critical`), porque quem as grava é uma automação e
 * não pode depender de um rótulo que o escritório renomeia. A tradução é daqui — é o preço, pequeno
 * e explícito, de as duas entidades serem independentes.
 */
const statusExpr = (prazo: string): string => `${prazo}.status == "Concluído" ? "closed" : "pending"`;

const priorityExpr = (prazo: string): string =>
  `${prazo}.priority == "Crítica" ? "critical" : (${prazo}.priority == "Alta" ? "high"`
  + ` : (${prazo}.priority == "Baixa" ? "low" : "medium"))`;

/**
 * O item da agenda montado a partir de um prazo. O `prazo` é o CAMINHO de onde ele vem — `event`
 * quando o gatilho é a gravação, `output.cadaPrazo` quando é a repetição do mutirão.
 *
 * Ser um construtor só, e não duas declarações parecidas, é o que garante que as duas portas
 * gravem o MESMO item: um campo acrescentado aqui aparece nas duas, e um esquecido não some só de
 * uma delas.
 */
const montarItem = (id: string, order: number, prazo: string): WorkflowStep => ({
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
          { name: 'title', value: { kind: 'Expression', expression: `${prazo}.type` } },
          { name: 'status', value: { kind: 'Expression', expression: statusExpr(prazo) } },
          { name: 'priority', value: { kind: 'Expression', expression: priorityExpr(prazo) } },
          { name: 'date', value: { kind: 'Expression', expression: `${prazo}.dueDate` } },
          { name: 'finishDate', value: { kind: 'Expression', expression: `${prazo}.completedAt` } },
          { name: 'description', value: { kind: 'Expression', expression: `${prazo}.description` } },
          { name: 'origem', value: { kind: 'Literal', value: 'deadlines' } },
          { name: 'origemId', value: { kind: 'Expression', expression: `${prazo}.id` } },
          { name: 'caseId', value: { kind: 'Expression', expression: `${prazo}.caseId` } },
          { name: 'personId', value: { kind: 'Expression', expression: `${prazo}.responsibleLawyerId` } },
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
    upsert: { kind: 'Literal', value: { table: CALENDAR_COLLECTION, source: 'input', property: 'item' } },
  },
});

/**
 * "Já existe item para este prazo?" — a pergunta que torna o espelho IDEMPOTENTE. Os dois ramos
 * publicam a mesma chave (`input.itemId`), como no "Criar Prazo": o passo que monta o item não sabe
 * por qual caminho o fluxo passou, e o Gravar Registro inclui quando ela é nula e atualiza quando
 * não é. Ler `output.<busca>.first.id` direto pareceria mais curto e quebraria na primeira vez —
 * sem item, `first` é nulo.
 */
const acharItem = (busca: string, order: number, prazoIdExpr: string): WorkflowStep[] => [
  buscar(busca, order, CALENDAR_COLLECTION, 'origemId', prazoIdExpr),
  {
    id: `${busca}Existe`,
    stepDefinitionId: '',
    type: 'Condition',
    order: order + 1,
    enabled: true,
    condition: naoEncontrou(busca),
    configuration: {},
    branches: {
      whenTrue: [publicarItemId(`${busca}Sem`, 0, null)],
      whenFalse: [publicarItemId(`${busca}Com`, 0, `output.${busca}.first.id`)],
    },
  },
];

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
 * O ESPELHO. Roda a cada gravação de prazo e deixa o item da agenda igual ao prazo — criando-o na
 * primeira vez, atualizando-o depois.
 */
const CALENDAR_SYNC_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-prazo-calendar-sync',
  name: 'Espelhar prazo no calendário',
  description: 'Mantém na agenda um item para cada prazo: cria na primeira gravação e atualiza nas seguintes.',
  eventName: 'deadline.saved',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [
    ...acharItem('buscarItem', 0, 'event.id'),
    montarItem('montarItem', 2, 'event'),
    gravarItem('gravarItem', 3),
  ],
};

/**
 * O MUTIRÃO — o espelho aplicado a quem já existia. O gatilho de gravação só alcança o prazo que
 * for salvo depois da instalação; este workflow é o que traz para a agenda os prazos que já
 * estavam no escritório, e pode ser chamado quantas vezes se quiser.
 *
 * **Rodar de novo não duplica nada** porque cada iteração faz a MESMA pergunta do espelho — existe
 * item com este `origemId`? — antes de gravar. Duas execuções seguidas produzem exatamente o mesmo
 * resultado; a segunda apenas reescreve os itens com os valores que eles já tinham.
 *
 * **Por que a situação é um parâmetro, e não "todos de uma vez".** O Step de consulta varre no
 * máximo 300 documentos e devolve no máximo 100 — teto do motor, não desta declaração. Só o
 * operador de igualdade é resolvido no SERVIDOR: filtrar por situação faz a varredura acontecer
 * dentro daquela fatia, em vez de nos 300 primeiros prazos do escritório inteiro. Daí o desenho:
 * uma execução por situação, e o passo final avisa quando a execução bateu no teto.
 */
const CALENDAR_BACKFILL_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-prazo-calendar-sincronizar',
  name: 'Sincronizar prazos no calendário',
  description:
    'Põe na agenda os prazos que já existiam antes da integração. Pode ser executado quantas vezes'
    + ' for preciso: cada prazo tem no máximo um item, e rodar de novo apenas o atualiza. Processa'
    + ' até 100 prazos por execução, dentro da situação escolhida.',
  eventName: 'workflow.called',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  parameters: [
    {
      key: 'status',
      label: 'Situação dos prazos a sincronizar',
      type: 'lookup',
      lookupCollection: 'deadlineStatuses',
      required: true,
      defaultValue: 'Pendente',
    },
  ],
  steps: [
    {
      id: 'buscarPrazos',
      stepDefinitionId: 'query',
      type: 'Action',
      order: 0,
      enabled: true,
      configuration: {
        query: {
          kind: 'Literal',
          value: {
            table: 'deadlines',
            where: [{ path: 'status', op: 'eq', value: { kind: 'Expression', expression: 'event.status' } }],
            orderBy: [{ path: 'dueDate', dir: 'desc' }],
            limit: 100,
            projections: [],
          },
        },
      },
    },
    {
      id: 'cadaPrazo',
      stepDefinitionId: '',
      type: 'Loop',
      order: 1,
      enabled: true,
      configuration: {},
      loop: {
        source: { kind: 'Expression', expression: 'output.buscarPrazos.results' },
        itemName: 'prazo',
        outputName: 'itens',
        // Dentro do corpo, o prazo da vez é `output.cadaPrazo` — o nó de repetição publica o item
        // corrente sob a própria chave, e as saídas do corpo são zeradas a cada volta.
        body: [
          ...acharItem('buscarItem', 0, 'output.cadaPrazo.id'),
          montarItem('montarItem', 2, 'output.cadaPrazo'),
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
              { name: 'sincronizados', value: { kind: 'Expression', expression: 'output.buscarPrazos.count' } },
              {
                name: 'status',
                value: {
                  kind: 'Expression',
                  expression:
                    'output.buscarPrazos.count >= 100'
                    + ' ? "Sincronizados 100 prazos — o teto de uma execução. Rode de novo para alcançar os demais."'
                    + ' : concat("Sincronizados ", output.buscarPrazos.count, " prazo(s) no calendário.")',
                },
              },
            ],
          },
        },
      },
    },
  ],
};

/** Prazo excluído, item fora da agenda. Sem item, o fluxo encerra — não há o que excluir. */
const CALENDAR_REMOVE_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-prazo-calendar-remover',
  name: 'Retirar prazo do calendário',
  description: 'Exclui da agenda o item do prazo que foi removido.',
  eventName: 'deadline.deleted',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [
    buscar('buscarItem', 0, CALENDAR_COLLECTION, 'origemId', 'event.id'),
    {
      id: 'itemExiste',
      stepDefinitionId: '',
      type: 'Condition',
      order: 1,
      enabled: true,
      condition: naoEncontrou('buscarItem'),
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
            table: CALENDAR_COLLECTION,
            id: { kind: 'Expression', expression: 'output.buscarItem.first.id' },
          },
        },
      },
    },
  ],
};

const responder = (id: string, order: number, message: string): WorkflowStep => ({
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
          { name: 'status', value: { kind: 'Literal', value: message } },
          { name: 'actions', value: { kind: 'Literal', value: ['refresh'] } },
        ],
      },
    },
  },
});

/**
 * Concluir pelo cartão da agenda. É o MESMO gesto que existe na listagem de prazos, e por isso ele
 * grava no PRAZO, não no item: quem atualiza a agenda é o espelho, na sequência. Escrever direto no
 * item deixaria a agenda dizendo "concluído" sobre um prazo que continua pendente.
 *
 * O prazo é encontrado pelo `origemId` do item que a agenda mandou — `event.context` é o registro
 * sobre o qual a ação foi disparada.
 */
const CALENDAR_CONCLUIR_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-prazo-calendar-concluir',
  name: 'Concluir prazo pela agenda',
  description: 'Marca como concluído o prazo que deu origem ao item do calendário.',
  eventName: 'workflow.called',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [
    {
      id: 'montar',
      stepDefinitionId: 'map',
      type: 'Action',
      order: 0,
      enabled: true,
      configuration: {
        map: {
          kind: 'Literal',
          value: {
            name: 'prazo',
            fields: [
              { name: 'id', value: { kind: 'Expression', expression: 'event.context.origemId' } },
              { name: 'status', value: { kind: 'Literal', value: 'Concluído' } },
              { name: 'completedAt', value: { kind: 'Expression', expression: 'today()' } },
            ],
          },
        },
      },
    },
    {
      id: 'gravar',
      stepDefinitionId: 'upsert',
      type: 'Action',
      order: 1,
      enabled: true,
      configuration: {
        upsert: { kind: 'Literal', value: { table: 'deadlines', source: 'input', property: 'prazo' } },
      },
    },
    responder('responder', 2, 'Prazo marcado como concluído.'),
  ],
};

const remarcar = (id: string, order: number, field: string): WorkflowStep => ({
  id,
  stepDefinitionId: 'map',
  type: 'Action',
  order,
  enabled: true,
  configuration: {
    map: {
      kind: 'Literal',
      value: {
        name: 'prazo',
        fields: [
          { name: 'id', value: { kind: 'Expression', expression: 'event.context.origemId' } },
          { name: field, value: { kind: 'Expression', expression: 'event.targetDate' } },
        ],
      },
    },
  },
});

/**
 * Arrastar o cartão para outro dia. O que a mudança SIGNIFICA é decisão daqui, e não da agenda: um
 * prazo pendente que muda de dia foi adiado (muda o vencimento); um prazo concluído que muda de dia
 * foi concluído noutro dia (muda a conclusão). É a mesma leitura que a agenda antiga tinha em
 * código — só que agora quem a sustenta é quem conhece prazo.
 *
 * "Vencido" continua sem ser carimbado: é situação derivada da data, que a listagem pinta. Gravá-la
 * aqui congelaria no registro algo que muda sozinho amanhã.
 */
const CALENDAR_MOVER_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-prazo-calendar-mover',
  name: 'Remarcar prazo pela agenda',
  description: 'Muda o vencimento do prazo (ou a data de conclusão, se ele já estiver concluído) quando o item é arrastado para outro dia.',
  eventName: 'workflow.called',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  parameters: [
    { key: 'targetDate', label: 'Novo dia', type: 'Date', required: true },
  ],
  steps: [
    {
      id: 'jaConcluido',
      stepDefinitionId: '',
      type: 'Condition',
      order: 0,
      enabled: true,
      condition: { kind: 'Expression', expression: 'event.context.status == "closed"' },
      configuration: {},
      branches: {
        whenTrue: [remarcar('remarcarConclusao', 0, 'completedAt')],
        whenFalse: [remarcar('remarcarVencimento', 0, 'dueDate')],
      },
    },
    {
      id: 'gravar',
      stepDefinitionId: 'upsert',
      type: 'Action',
      order: 1,
      enabled: true,
      configuration: {
        upsert: { kind: 'Literal', value: { table: 'deadlines', source: 'input', property: 'prazo' } },
      },
    },
    responder('responder', 2, 'Prazo remarcado.'),
  ],
};

const ACTIONS: ActionModuleTemplate[] = [
  {
    templateId: 'act-prazo-calendar-concluir',
    key: 'prazo_calendar_concluir',
    title: 'Marcar como concluído',
    icon: 'check',
    workflowId: 'wf-prazo-calendar-concluir',
    /**
     * A expressão é avaliada sobre o ITEM DA AGENDA, não sobre o prazo — é o registro do cartão em
     * que o gesto aparece. Daí `status == "closed"` (a chave da agenda) e não `"Concluído"` (o
     * rótulo do prazo). A segunda metade é o que mantém o gesto do prazo restrito aos itens dele: a
     * mesma lista de ações serve a agenda inteira, e sem isso ele apareceria no item de qualquer
     * outra extensão.
     */
    hiddenWhen: 'origem != "deadlines" or status == "closed"',
    danger: false,
    enabled: true,
    order: 0,
  },
  {
    templateId: 'act-prazo-calendar-mover',
    key: 'prazo_calendar_mover',
    title: 'Remarcar prazo',
    icon: 'time',
    workflowId: 'wf-prazo-calendar-mover',
    danger: false,
    enabled: true,
    order: 1,
  },
  {
    templateId: 'act-prazo-concluir',
    key: 'prazo_concluir',
    title: 'Marcar como concluído',
    icon: 'check',
    workflowId: 'wf-prazo-concluir',
    // O gesto só existe enquanto há o que concluir — prazo encerrado (concluído ou cancelado) não
    // volta pelo cartão, e registro novo ainda não tem status gravado.
    hiddenWhen: 'isNew or status == "Concluído" or status == "Cancelado"',
    danger: false,
    enabled: true,
    order: 0,
  },
];

const PRAZOS_SCREEN: ScreenModuleTemplate = {
  key: 'prazos',
  sourceId: SOURCE_ID,
  sourceRev: 1,
  titleSingular: 'Prazo',
  titlePlural: 'Prazos',
  icon: 'time',
  dataCollection: 'deadlines',
  fields: FIELDS,
  titleFieldKey: 'type',
  subtitleFieldKey: 'status',
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  // Os eventos que as automações escutam continuam sendo `deadline.saved`/`deadline.deleted`.
  eventPrefix: 'deadline',
  listActions: ['copyLink', 'delete'],
  viewActionIds: ['act-prazo-concluir'],
  cardActionIds: ['act-prazo-concluir'],
  // O menu e a página vêm das contribuições da extensão, que apontam para a view própria.
  sidebarOrder: 0,
  hideFromSidebar: true,
};

/**
 * A listagem. Do padrão vêm filtros, ações do cartão e os modais; a view injeta o que é do Prazo: a
 * faixa de prioridade no alto do cartão, o número do processo clicável com o chip de dias que o
 * acompanha, e os selos de situação e prioridade.
 */
const PRAZOS_SOURCE = `
import { useMemo } from 'react';
import { styled, useTheme } from 'styled-components';
import { Icon, RecordListSurface, InfoBanner } from '@microteia/ui';
import { useEntityList, useCollection, useLookup, useOpenRecord } from '@microteia/data';
import { getConfigColor } from '@microteia/theme';

const SOURCE_ID = 'microteia:prazo';

const CaseRow = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.xs};
  margin-top: 2px;
  min-width: 0;
\`;

const CaseNumber = styled.button\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
  font-family: \${({ theme }) => theme.fonts.mono};
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  transition: \${({ theme }) => theme.transitions.fast};

  &:hover { color: \${({ theme }) => theme.colors.primary}; text-decoration: underline; }
\`;

const DaysChip = styled.span\`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: auto;
  padding: 1px 7px;
  border-radius: \${({ theme }) => theme.borderRadius.full};
  font-size: 10px;
  font-weight: 600;
  font-family: \${({ theme }) => theme.fonts.mono};
  white-space: nowrap;
  background: \${({ $tone, theme }) => $tone ? theme.colors[$tone] + '20' : theme.colors.surfaceHover};
  color: \${({ $tone, theme }) => $tone ? theme.colors[$tone] : theme.colors.textMuted};
  border: 1px solid \${({ $tone, theme }) => $tone ? theme.colors[$tone] + '44' : theme.colors.border};
\`;

const Badges = styled.div\`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
\`;

const MetaBadge = styled.span\`
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: \${({ theme }) => theme.borderRadius.full};
  font-size: 10px;
  font-weight: 500;
  background: \${({ $color }) => $color + '20'};
  color: \${({ $color }) => $color};
  border: 1px solid \${({ $color }) => $color + '40'};
  flex-shrink: 0;
\`;

const dateOf = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
};

const startOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const daysUntilDue = (record) => {
  const due = dateOf(record.dueDate);
  if (!due) return null;
  return Math.round((startOfDay(due).getTime() - startOfDay(new Date()).getTime()) / 86400000);
};

// Vencido é comparação de DIA, não de instante: um prazo gravado por automação nasce à meia-noite,
// e comparar por instante o marcaria como vencido às 00h01 do próprio dia — "0d vencido" onde o
// cartão deve dizer "Hoje". É a mesma unidade que daysUntilDue usa.
const isOverdue = (record) => {
  const due = dateOf(record.dueDate);
  return record.status === 'Pendente' && !!due && startOfDay(due).getTime() < startOfDay(new Date()).getTime();
};

const PRIORITY_ORDER = { 'Crítica': 3, 'Alta': 2, 'Média': 1, 'Baixa': 0 };

/**
 * A lista de prazos se lê do vencimento mais PRÓXIMO ao mais distante — é uma agenda, não um
 * cadastro —, e o empate do dia se desfaz pela prioridade. Fora do componente de propósito: um
 * comparador novo a cada render reordenaria a lista inteira sem que nada tivesse mudado.
 */
const byDueDateThenPriority = (a, b) => {
  const at = dateOf(a.dueDate) ? dateOf(a.dueDate).getTime() : Infinity;
  const bt = dateOf(b.dueDate) ? dateOf(b.dueDate).getTime() : Infinity;
  if (at !== bt) return at - bt;
  const ap = PRIORITY_ORDER[a.priority] != null ? PRIORITY_ORDER[a.priority] : -1;
  const bp = PRIORITY_ORDER[b.priority] != null ? PRIORITY_ORDER[b.priority] : -1;
  return bp - ap;
};

// A visão útil de quem abre Prazos é o que ainda está de pé: sem isso, a primeira tela é o histórico
// inteiro do escritório, com os concluídos misturados aos pendentes.
const PENDENTES = [{ key: 'status', values: ['Pendente'] }];

export default function PrazosView() {
  const theme = useTheme();
  const list = useEntityList(SOURCE_ID, { defaultFilterTokens: PENDENTES, sortRecords: byDueDateThenPriority });
  const cases = useCollection('cases');
  const statusOptions = useLookup('deadlineStatuses');
  const priorityOptions = useLookup('deadlinePriorities');
  const openRecord = useOpenRecord();

  const caseNumberById = useMemo(() => {
    const map = {};
    for (const item of cases) map[item.id] = item.caseNumber || '';
    return map;
  }, [cases]);

  if (!list.definition) {
    return <div style={{ padding: '24px' }}><InfoBanner message='Tela "Prazos" não encontrada. Instale a extensão para ativá-la.' variant="warning" /></div>;
  }

  const priorityColor = (record) => getConfigColor(priorityOptions, record.priority, theme);

  const renderDaysChip = (record) => {
    if (record.status === 'Concluído') return <DaysChip $tone="success">Concluído</DaysChip>;
    if (record.status === 'Cancelado') return <DaysChip>Cancelado</DaysChip>;
    const days = daysUntilDue(record);
    if (days == null) return null;
    if (isOverdue(record)) {
      return <DaysChip $tone="danger"><Icon name="alert" size={10} />{Math.abs(days)}d vencido</DaysChip>;
    }
    if (days === 0) return <DaysChip $tone="warning">Hoje</DaysChip>;
    if (days === 1) return <DaysChip $tone="warning">Amanhã</DaysChip>;
    return <DaysChip>{days}d</DaysChip>;
  };

  const renderSubtitle = (record) => {
    const number = caseNumberById[record.caseId];
    return (
      <CaseRow>
        {number ? (
          <CaseNumber
            title={'Abrir processo ' + number}
            onClick={(e) => { e.stopPropagation(); openRecord('cases', record.caseId); }}
          >
            {number}
          </CaseNumber>
        ) : null}
        {renderDaysChip(record)}
      </CaseRow>
    );
  };

  const renderBelowHeader = (record) => (
    <Badges>
      <MetaBadge $color={getConfigColor(statusOptions, record.status, theme)}>{record.status}</MetaBadge>
      <MetaBadge $color={priorityColor(record)}>{record.priority}</MetaBadge>
    </Badges>
  );

  return (
    <RecordListSurface
      vm={list}
      definition={list.definition}
      accentColor={priorityColor}
      renderSubtitle={renderSubtitle}
      renderBelowHeader={renderBelowHeader}
      emptyTitle="Nenhum prazo encontrado"
      emptyActionLabel="Cadastrar primeiro prazo"
    />
  );
}
`;

/**
 * O STARTUP: comandos de ⌘K e a menção `@prazo` das anotações — o que era um provider do kernel. A
 * tela é resolvida pelo `sourceId`, então acompanha a chave instalada.
 */
const STARTUP_SOURCE = `
import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:prazo';
const LIST_KEY = 'prazos';
const GROUP = 'Prazos';

const viewKey = (screen, id) => 'view-dyn:' + screen.id + ':' + id;

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

/**
 * A busca casa só o TÍTULO (o tipo do prazo). O subtítulo é o STATUS, uma classificação que todo
 * registro repete: casá-la devolveria a agenda inteira para quem digitasse "pen". Quem inclui o
 * subtítulo é Processos e Contratos, onde ele é o NÚMERO do registro.
 */
const matches = (record, screen, q) => {
  if (!q) return true;
  return textOf(record, screen.titleFieldKey).toLowerCase().indexOf(q) !== -1;
};

const recordsOf = (ctx, screen) => {
  const collection = screen.dataCollection || screen.id;
  return ctx.records.filter((r) => r.collection === collection && textOf(r, screen.titleFieldKey));
};

export default function startup(host) {
  host.commands.register({
    group: GROUP,
    getItems(query, ctx) {
      const q = String(query || '').toLowerCase().trim();
      if (!q) return [];
      const screen = screenOf(ctx);
      if (!screen) return [];
      const icon = <Icon name="time" size={16} />;
      const items = [];
      if ('novo prazo'.indexOf(q) !== -1) {
        items.push({ id: 'prazo:new', title: 'Novo prazo', group: GROUP, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if ('abrir prazos'.indexOf(q) !== -1) {
        items.push({ id: 'prazo:list', title: 'Abrir Prazos', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, screen, q)) continue;
        items.push({
          id: 'prazo:' + r.id,
          title: textOf(r, screen.titleFieldKey),
          subtitle: textOf(r, screen.subtitleFieldKey) || 'Prazo',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab(viewKey(screen, r.id)); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'prazo',
    label: 'Prazo',
    description: 'Inserir link para um prazo',
    icon: 'time',
    search(query, ctx) {
      const screen = screenOf(ctx);
      if (!screen) return [];
      const q = String(query || '').toLowerCase().trim();
      return recordsOf(ctx, screen)
        .filter((r) => matches(r, screen, q))
        .slice(0, 20)
        .map((record) => ({
          id: record.id,
          title: textOf(record, screen.titleFieldKey),
          subtitle: textOf(record, screen.subtitleFieldKey) || 'Prazo',
          tabKey: viewKey(screen, record.id),
        }));
    },
  });
}
`;


/**
 * Os WIDGETS do Dashboard. Eles são desta extensão de propósito: quem sabe o que é um prazo pendente,
 * o que é vencer e como se lê uma prioridade é ela — o Dashboard só oferece o lugar. Instalar Prazos
 * faz os cartões aparecerem; desinstalar os retira, sem que o Dashboard saiba de nada.
 */
const WIDGET_HELPERS = `
const DAY = 86400000;

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const dayTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const isOverdue = (deadline, today) => {
  const due = dayTime(deadline.dueDate);
  if (due === null) return false;
  return deadline.status === 'Vencido' || (deadline.status === 'Pendente' && due < today);
};
`;

const WIDGET_CARD = `
const Card = styled.div\`
  background: \${({ theme }) => theme.colors.surface};
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.lg};
  padding: \${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.md};
  height: 100%;
\`;

const Head = styled.div\`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: \${({ theme }) => theme.spacing.sm};
\`;

const Title = styled.h3\`
  font-size: \${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  color: \${({ theme }) => theme.colors.text};
\`;

const Empty = styled.div\`
  padding: \${({ theme }) => theme.spacing.lg};
  text-align: center;
  color: \${({ theme }) => theme.colors.textMuted};
  font-size: \${({ theme }) => theme.fontSizes.sm};
\`;

const List = styled.div\`
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.sm};
\`;

const Item = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.sm};
  padding: \${({ theme }) => theme.spacing.sm} \${({ theme }) => theme.spacing.md};
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.md};
  background: \${({ theme }) => theme.colors.background};
  cursor: pointer;
  &:hover { border-color: \${({ theme }) => theme.colors.primary}; }
\`;

const Bar = styled.div\`
  width: 4px;
  height: 32px;
  border-radius: 4px;
  flex-shrink: 0;
  background: \${({ $color }) => $color};
\`;

const Info = styled.div\`
  flex: 1;
  min-width: 0;
\`;

const ItemTitle = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.sm};
  font-weight: 500;
  color: \${({ theme }) => theme.colors.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
\`;

const ItemSub = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
  font-family: \${({ theme }) => theme.fonts.mono};
\`;

const Chip = styled.span\`
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: \${({ theme }) => theme.borderRadius.full};
  font-size: 10px;
  font-weight: 600;
  font-family: \${({ theme }) => theme.fonts.mono};
  white-space: nowrap;
  color: \${({ $color, theme }) => $color || theme.colors.textMuted};
  border: 1px solid \${({ $color, theme }) => $color || theme.colors.border};
\`;
`;

const PRAZOS_NUMEROS_SOURCE = `
import { useMemo } from 'react';
import { styled, useTheme } from 'styled-components';
import { useCollection, useOpenScreenList } from '@microteia/data';
${WIDGET_HELPERS}
${WIDGET_CARD}
const Stats = styled.div\`
  display: flex;
  gap: \${({ theme }) => theme.spacing.lg};
\`;

const Stat = styled.button\`
  flex: 1;
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
\`;

const Value = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes['2xl']};
  font-weight: 700;
  line-height: 1.2;
  color: \${({ $color, theme }) => $color || theme.colors.text};
\`;

const Label = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.sm};
  color: \${({ theme }) => theme.colors.textMuted};
\`;

export default function PrazosNumerosWidget() {
  const theme = useTheme();
  const deadlines = useCollection('deadlines');
  const openList = useOpenScreenList();

  const counts = useMemo(() => {
    const today = startOfToday().getTime();
    return {
      pendentes: deadlines.filter((d) => d.status === 'Pendente').length,
      vencidos: deadlines.filter((d) => isOverdue(d, today)).length,
    };
  }, [deadlines]);

  return (
    <Card>
      <Head><Title>Prazos</Title></Head>
      <Stats>
        <Stat onClick={() => openList('deadlines', [{ key: 'status', values: ['Pendente'] }])}>
          <Value>{counts.pendentes}</Value>
          <Label>Pendentes</Label>
        </Stat>
        <Stat onClick={() => openList('deadlines', [{ key: 'status', values: ['Vencido'] }])}>
          <Value $color={counts.vencidos > 0 ? theme.colors.danger : undefined}>{counts.vencidos}</Value>
          <Label>Vencidos</Label>
        </Stat>
      </Stats>
    </Card>
  );
}
`;

const PRAZOS_PROXIMOS_SOURCE = `
import { useMemo } from 'react';
import { styled, useTheme } from 'styled-components';
import { Button } from '@microteia/ui';
import { useCollection, useLookup, useOpenRecord, useOpenScreenList } from '@microteia/data';
import { getConfigColor } from '@microteia/theme';
${WIDGET_HELPERS}
${WIDGET_CARD}
export default function PrazosProximosWidget() {
  const theme = useTheme();
  const deadlines = useCollection('deadlines');
  const cases = useCollection('cases');
  const priorities = useLookup('deadlinePriorities');
  const openRecord = useOpenRecord();
  const openList = useOpenScreenList();

  const items = useMemo(() => {
    const today = startOfToday().getTime();
    const limit = today + 7 * DAY;
    return deadlines
      .filter((d) => d.status === 'Pendente')
      .filter((d) => {
        const due = dayTime(d.dueDate);
        return due !== null && due >= today && due <= limit;
      })
      .sort((a, b) => dayTime(a.dueDate) - dayTime(b.dueDate))
      .map((d) => {
        const days = Math.round((dayTime(d.dueDate) - today) / DAY);
        const relatedCase = cases.find((c) => c.id === d.caseId);
        return {
          record: d,
          days,
          caseNumber: relatedCase ? relatedCase.caseNumber : '—',
        };
      });
  }, [deadlines, cases]);

  return (
    <Card>
      <Head>
        <Title>Prazos nos Próximos 7 Dias</Title>
        <Button size="sm" variant="ghost" onClick={() => openList('deadlines', [{ key: 'status', values: ['Pendente'] }])}>
          Ver todos
        </Button>
      </Head>
      {items.length === 0 ? (
        <Empty>Nenhum prazo nos próximos 7 dias 🎉</Empty>
      ) : (
        <List>
          {items.map((item) => (
            <Item key={item.record.id} onClick={() => openRecord('deadlines', item.record.id)}>
              <Bar $color={getConfigColor(priorities, item.record.priority, theme)} />
              <Info>
                <ItemTitle>{item.record.type}</ItemTitle>
                <ItemSub>{item.caseNumber}</ItemSub>
              </Info>
              <Chip $color={item.days <= 1 ? theme.colors.warning : undefined}>
                {item.days === 0 ? 'Hoje' : item.days === 1 ? 'Amanhã' : item.days + 'd'}
              </Chip>
            </Item>
          ))}
        </List>
      )}
    </Card>
  );
}
`;

const PRAZOS_VENCIDOS_SOURCE = `
import { useMemo } from 'react';
import { styled, useTheme } from 'styled-components';
import { Button } from '@microteia/ui';
import { useCollection, useLookup, useOpenRecord, useOpenScreenList } from '@microteia/data';
import { getConfigColor } from '@microteia/theme';
${WIDGET_HELPERS}
${WIDGET_CARD}
export default function PrazosVencidosWidget() {
  const theme = useTheme();
  const deadlines = useCollection('deadlines');
  const cases = useCollection('cases');
  const priorities = useLookup('deadlinePriorities');
  const openRecord = useOpenRecord();
  const openList = useOpenScreenList();

  const items = useMemo(() => {
    const today = startOfToday().getTime();
    return deadlines
      .filter((d) => isOverdue(d, today))
      .sort((a, b) => dayTime(a.dueDate) - dayTime(b.dueDate))
      .slice(0, 6)
      .map((d) => {
        const relatedCase = cases.find((c) => c.id === d.caseId);
        return {
          record: d,
          days: Math.round((today - dayTime(d.dueDate)) / DAY),
          caseNumber: relatedCase ? relatedCase.caseNumber : '—',
        };
      });
  }, [deadlines, cases]);

  return (
    <Card>
      <Head>
        <Title>Prazos Vencidos</Title>
        <Button size="sm" variant="ghost" onClick={() => openList('deadlines', [{ key: 'status', values: ['Vencido'] }])}>
          Ver todos
        </Button>
      </Head>
      {items.length === 0 ? (
        <Empty>Nenhum prazo vencido 👍</Empty>
      ) : (
        <List>
          {items.map((item) => (
            <Item key={item.record.id} onClick={() => openRecord('deadlines', item.record.id)}>
              <Bar $color={getConfigColor(priorities, item.record.priority, theme)} />
              <Info>
                <ItemTitle>{item.record.type}</ItemTitle>
                <ItemSub>{item.caseNumber}</ItemSub>
              </Info>
              <Chip $color={theme.colors.danger}>{item.days}d vencido</Chip>
            </Item>
          ))}
        </List>
      )}
    </Card>
  );
}
`;

/**
 * A "Análise de Prazos" que era um componente do kernel (`DeadlineCharts`), agora widget desta
 * extensão. O kernel ficou só com a PRIMITIVA de gráfico (`TimeSeriesChart`/`DonutChart`), que não
 * sabe o que desenha; a regra — vencimento para frente, conclusão para trás, uma série por tipo — é
 * de quem conhece prazo.
 */
const PRAZOS_ANALISE_SOURCE = `
import { useMemo, useState } from 'react';
import { styled, useTheme } from 'styled-components';
import { TimeSeriesChart, DonutChart } from '@microteia/ui';
import { useCollection } from '@microteia/data';
${WIDGET_HELPERS}
${WIDGET_CARD}
const Controls = styled.div\`
  display: flex;
  flex-wrap: wrap;
  gap: \${({ theme }) => theme.spacing.xs};
  align-items: center;
\`;

const Toggle = styled.button\`
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.md};
  padding: \${({ theme }) => theme.spacing.xs} \${({ theme }) => theme.spacing.sm};
  font-size: \${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  cursor: pointer;
  background: \${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  color: \${({ $active, theme }) => ($active ? theme.colors.white : theme.colors.textSecondary)};
\`;

const Panels = styled.div\`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: \${({ theme }) => theme.spacing.lg};
  @media (max-width: 900px) { grid-template-columns: 1fr; }
\`;

const Legend = styled.div\`
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.xs};
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textSecondary};
\`;

const LegendRow = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.sm};
\`;

const Dot = styled.span\`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: \${({ $color }) => $color};
  flex-shrink: 0;
\`;

const PERIODS = [7, 15, 30, 60];

const label = (time) => {
  const date = new Date(time);
  const pad = (n) => String(n).padStart(2, '0');
  return pad(date.getDate()) + '/' + pad(date.getMonth() + 1);
};

export default function PrazosAnaliseWidget() {
  const theme = useTheme();
  const deadlines = useCollection('deadlines');
  const [mode, setMode] = useState('dueDate');
  const [period, setPeriod] = useState(30);
  const [hidden, setHidden] = useState([]);

  const palette = [
    theme.colors.primary, theme.colors.secondary, theme.colors.success,
    theme.colors.warning, theme.colors.danger, theme.colors.info,
  ];

  const analysis = useMemo(() => {
    const today = startOfToday().getTime();
    const isCompleted = mode === 'completedAt';
    const start = isCompleted ? today - period * DAY : today;
    const end = isCompleted ? today : today + period * DAY;

    const inPeriod = deadlines.filter((d) => {
      const reference = dayTime(isCompleted ? d.completedAt : d.dueDate);
      return reference !== null && reference >= start && reference <= end;
    });

    const types = Array.from(new Set(inPeriod.map((d) => d.type || 'Sem tipo'))).sort();
    const colorOf = {};
    types.forEach((type, index) => { colorOf[type] = palette[index % palette.length]; });

    const rows = [];
    for (let time = start; time <= end; time += DAY) {
      const row = { date: label(time) };
      for (const type of types) {
        row[type] = inPeriod.filter((d) => {
          const reference = dayTime(isCompleted ? d.completedAt : d.dueDate);
          return (d.type || 'Sem tipo') === type && reference === time;
        }).length;
      }
      rows.push(row);
    }

    const slices = types
      .map((type) => ({
        name: type,
        value: inPeriod.filter((d) => (d.type || 'Sem tipo') === type).length,
        color: colorOf[type],
      }))
      .filter((slice) => slice.value > 0)
      .sort((a, b) => b.value - a.value);

    return { rows, slices, types, colorOf, total: inPeriod.length };
  }, [deadlines, mode, period, palette]);

  const series = analysis.types
    .filter((type) => hidden.indexOf(type) === -1)
    .map((type) => ({ key: type, label: type, color: analysis.colorOf[type] }));

  const toggleType = (type) => setHidden((prev) =>
    prev.indexOf(type) === -1 ? prev.concat([type]) : prev.filter((item) => item !== type));

  return (
    <Card>
      <Head>
        <Title>Análise de Prazos</Title>
        <Controls>
          <Toggle $active={mode === 'dueDate'} onClick={() => setMode('dueDate')}>Por vencimento</Toggle>
          <Toggle $active={mode === 'completedAt'} onClick={() => setMode('completedAt')}>Por conclusão</Toggle>
          {PERIODS.map((days) => (
            <Toggle key={days} $active={period === days} onClick={() => setPeriod(days)}>{days}d</Toggle>
          ))}
        </Controls>
      </Head>
      {analysis.total === 0 ? (
        <Empty>Nenhum prazo no período</Empty>
      ) : (
        <Panels>
          <TimeSeriesChart data={analysis.rows} xKey="date" series={series} height={240} />
          <div>
            <DonutChart data={analysis.slices} height={180} />
            <Legend>
              {analysis.slices.map((slice) => (
                <LegendRow key={slice.name} onClick={() => toggleType(slice.name)} style={{ cursor: 'pointer', opacity: hidden.indexOf(slice.name) === -1 ? 1 : 0.4 }}>
                  <Dot $color={slice.color} />
                  <span>{slice.name}</span>
                  <span>{Math.round((slice.value / analysis.total) * 100)}%</span>
                </LegendRow>
              ))}
            </Legend>
          </div>
        </Panels>
      )}
    </Card>
  );
}
`;

export const prazoPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.prazo',
    version: '1.1.1',
    kernel: '^1.0.0',
    name: 'Prazos',
    description: 'O controle de prazos do escritório recriado como extensão, sobre os MESMOS prazos — a quinta entidade a sair do kernel.',
    publisher: { name: 'Microteia' },
    // Todo prazo é de um processo, e pode ter um advogado responsável: as duas coleções vêm das
    // extensões que as declaram, e é por isso que as duas precisam estar instaladas.
    dependencies: {
      'core.ui': '^1.0.0',
      'com.microteia.pessoa': { version: '^1.0.0', collections: ['persons'] },
      'com.microteia.processo': { version: '^2.0.0', collections: ['cases'] },
      // O prazo se mostra na agenda, e a agenda é de outra extensão: sem ela, a coleção `calendar`
      // não existe e o espelho gravaria no vazio.
      'com.microteia.calendar': { version: '^1.0.0', collections: ['calendar'] },
    },
    contributes: [
      nav({ key: 'prazos', label: 'Prazos', icon: 'time', order: 60 }),
      page({ key: 'prazos', title: 'Prazos', icon: 'time' }, 'prazos'),
      surfaceWidget({ surface: 'dashboard', key: 'prazo.numeros', title: 'Prazos em números', description: 'Quantos prazos estão pendentes e quantos venceram.', icon: 'time', defaultSpan: 1, order: 20 }, 'widget-prazos-numeros'),
      surfaceWidget({ surface: 'dashboard', key: 'prazo.proximos', title: 'Prazos nos próximos 7 dias', description: 'Os prazos pendentes que vencem nesta semana.', icon: 'calendar', defaultSpan: 1, order: 40 }, 'widget-prazos-proximos'),
      surfaceWidget({ surface: 'dashboard', key: 'prazo.vencidos', title: 'Prazos vencidos', description: 'O que passou do vencimento e continua pendente.', icon: 'alarmWarning', defaultSpan: 1, order: 50 }, 'widget-prazos-vencidos'),
      surfaceWidget({ surface: 'dashboard', key: 'prazo.analise', title: 'Análise de prazos', description: 'Gráficos por tipo, por vencimento ou por conclusão.', icon: 'barChart', defaultSpan: 3, order: 90 }, 'widget-prazos-analise'),
      // O gesto de ARRASTO. É o único que precisa de contribuição: o de concluir vai pela lista de
      // ações da tela (ver `CALENDAR_PATCH`), porque lá existe a lista equivalente — para "mudar de
      // dia" não existe. A `origem` é o que faz a agenda oferecê-lo só aos itens de prazo; o
      // `actionSourceId` é o endereço estável da Action, já que o id real só nasce na instalação.
      pointContribution('calendar.moveaction', 'prazo-mover', {
        key: 'prazo.mover',
        title: 'Remarcar o prazo',
        description: 'Arrastar um prazo para outro dia muda o vencimento — ou a data de conclusão, se ele já estiver concluído.',
        icon: 'time',
        order: 0,
        origem: 'deadlines',
        actionSourceId: 'act-prazo-calendar-mover',
      }),
    ],
  },
  summary:
    'A agenda de prazos do escritório: tipo, prioridade, vencimento e responsável, sempre ligados a um processo — com a lista aberta nos pendentes, ordenada do vencimento mais próximo ao mais distante, o gesto de marcar como concluído no próprio cartão e a automação "Criar Prazo", que encontra o processo pelo número antes de gravar.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'A extensão **Prazos** traz o controle de prazos do escritório: cada prazo com tipo, prioridade, vencimento e advogado responsável, ligado ao processo de origem.\n\nA listagem abre nos prazos pendentes e se lê do vencimento mais próximo ao mais distante. Cada cartão mostra, de uma olhada, a prioridade na faixa colorida do alto, o número do processo e quantos dias faltam — ou há quantos dias venceu. Marcar como concluído é um gesto do próprio cartão.\n\nVem junto a automação **Criar Prazo**, que outras automações podem chamar: ela recebe o NÚMERO do processo e o NOME do advogado, encontra os dois e só então grava — se o processo não existir, ela para e avisa, em vez de criar um prazo solto.\n\nAs listas de Tipo, Prioridade e Status já vêm preenchidas e são suas.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Prazos" no menu' },
          { label: 'Cadastro', value: '8 campos, em 3 seções' },
          { label: 'No cartão', value: 'Faixa de prioridade e dias para vencer' },
          { label: 'Automações', value: 'Criar Prazo e Marcar como concluído' },
          { label: 'Abre em', value: 'Prazos pendentes' },
        ],
      },
      {
        type: 'banner',
        message: 'Remover a extensão remove a tela, nunca os prazos: os registros e as listas de opções continuam no escritório e voltam a aparecer se ela for instalada de novo.',
        variant: 'info',
      },
    ],
  },
  workflows: [
    CRIAR_WORKFLOW,
    CONCLUIR_WORKFLOW,
    CALENDAR_SYNC_WORKFLOW,
    CALENDAR_BACKFILL_WORKFLOW,
    CALENDAR_REMOVE_WORKFLOW,
    CALENDAR_CONCLUIR_WORKFLOW,
    CALENDAR_MOVER_WORKFLOW,
  ],
  actions: ACTIONS,
  screens: [PRAZOS_SCREEN],
  screenPatches: [CALENDAR_PATCH],
  lookups: LOOKUPS,
  startup: STARTUP_SOURCE,
  views: [
    {
      key: 'prazos',
      title: 'Prazos',
      icon: 'time',
      source: PRAZOS_SOURCE,
    },
    { key: 'widget-prazos-numeros', title: 'Prazos em números', icon: 'time', source: PRAZOS_NUMEROS_SOURCE },
    { key: 'widget-prazos-proximos', title: 'Prazos nos próximos 7 dias', icon: 'calendar', source: PRAZOS_PROXIMOS_SOURCE },
    { key: 'widget-prazos-vencidos', title: 'Prazos vencidos', icon: 'alarmWarning', source: PRAZOS_VENCIDOS_SOURCE },
    { key: 'widget-prazos-analise', title: 'Análise de prazos', icon: 'barChart', source: PRAZOS_ANALISE_SOURCE },
  ],
};
