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
 * **Financeiro** — os lançamentos do escritório, inteiros, declarados por extensão: campos, listas
 * de opções, etiquetas, o cartão da listagem, os filtros, o prefixo dos eventos e quem pode gravar.
 *
 * `dataCollection: 'financials'` aponta para a coleção onde os lançamentos já estão — nada se move,
 * e os eventos (`financial.saved`) que as automações escutam seguem com o mesmo nome.
 *
 * O que ANTES era código do kernel e agora é declaração: os três botões de fluxo (registrar
 * pagamento, estornar, registrar cancelamento) viraram **Actions** sobre workflows, com as
 * expressões que decidem quando cada uma aparece; e o filtro de período do vencimento virou o
 * filtro de intervalo que todo campo de data passou a ter.
 */
const SOURCE_ID = 'microteia:financeiro';

const LANCAMENTO = 'Lançamento';
const DATAS = 'Datas';
const PAGAMENTO = 'Pagamento';
const VINCULOS = 'Vínculos e Observações';

const FIELDS: TemplateField[] = [
  { key: 'type', label: 'Tipo', type: 'select', required: true, order: 0, section: LANCAMENTO, lookupCollection: 'financialTypes', optionsColored: true, filterable: true, placeholder: 'Selecione o tipo...' },
  { key: 'category', label: 'Categoria', type: 'select', required: true, order: 1, section: LANCAMENTO, lookupCollection: 'financialCategories', optionsAllowUserAdd: true, filterable: true, placeholder: 'Selecione a categoria...' },
  { key: 'amount', label: 'Valor', type: 'currency', required: true, order: 2, section: LANCAMENTO },
  { key: 'status', label: 'Status', type: 'select', required: true, order: 3, section: LANCAMENTO, lookupCollection: 'financialStatuses', optionsAllowUserAdd: true, optionsColored: true, filterable: true, placeholder: 'Selecione o status...' },
  { key: 'dueDate', label: 'Vencimento', type: 'date', required: true, order: 4, section: DATAS, filterable: true },
  { key: 'paymentDate', label: 'Data de pagamento', type: 'date', required: false, order: 5, section: DATAS, filterable: true },
  { key: 'cancelDate', label: 'Data de cancelamento', type: 'date', required: false, order: 6, section: DATAS },
  { key: 'paymentMethod', label: 'Forma de pagamento', type: 'select', required: false, order: 7, section: PAGAMENTO, lookupCollection: 'financialPaymentMethods', optionsAllowUserAdd: true, filterable: true, placeholder: 'Selecione a forma...' },
  { key: 'costCenter', label: 'Centro de custo', type: 'select', required: false, order: 8, section: PAGAMENTO, lookupCollection: 'contractCostCenters', optionsAllowUserAdd: true, filterable: true, showInList: true, listIcon: 'wallet', listOrder: 3 },
  { key: 'invoiceNumber', label: 'Número da nota', type: 'text', required: false, order: 9, section: PAGAMENTO },
  { key: 'personId', label: 'Pessoa', type: 'reference', required: false, order: 10, section: VINCULOS, refEntity: 'persons', placeholder: 'Selecione a pessoa...', filterable: true, showInList: true, listIcon: 'team', listOrder: 0 },
  { key: 'caseId', label: 'Processo', type: 'reference', required: false, order: 11, section: VINCULOS, refEntity: 'cases', placeholder: 'Selecione o processo...', filterable: true, showInList: true, listIcon: 'folder', listOrder: 1 },
  { key: 'contractId', label: 'Contrato', type: 'reference', required: false, order: 12, section: VINCULOS, refEntity: 'contracts', placeholder: 'Selecione o contrato...', filterable: true, showInList: true, listIcon: 'fileText', listOrder: 2 },
  { key: 'notes', label: 'Observações', type: 'textarea', required: false, order: 13, section: VINCULOS },
];

const opts = (labels: string[]): CustomFieldOption[] => labels.map((label) => ({ key: label, label }));

const colored = (entries: [string, string][]): CustomFieldOption[] =>
  entries.map(([label, color]) => ({ key: label, label, color }));

/**
 * As listas com as opções de PARTIDA — semeadas só quando a lista está vazia no escritório; dali em
 * diante são dele. `contractCostCenters` NÃO é declarada aqui: ela vem da extensão de Contratos, e é
 * de propósito que as duas telas compartilhem o mesmo centro de custo.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: 'financialTypes',
    label: 'Financeiro: Tipo',
    options: colored([['Receita', 'revenue'], ['Despesa', 'expense']]),
  },
  {
    collection: 'financialCategories',
    label: 'Financeiro: Categoria',
    options: opts([
      'Honorários', 'Êxito', 'Mensalidade', 'Custas Judiciais', 'Perícia',
      'Deslocamento', 'Escritório', 'Impostos', 'Outros',
    ]),
  },
  {
    collection: 'financialStatuses',
    label: 'Financeiro: Status',
    options: colored([['Aberto', 'warning'], ['Pago', 'success'], ['Cancelado', 'textSecondary']]),
  },
  {
    collection: 'financialPaymentMethods',
    label: 'Financeiro: Forma de Pagamento',
    options: opts(['PIX', 'Transferência', 'Dinheiro', 'Cartão', 'Cheque', 'Outro']),
  },
];

/**
 * Os três gestos do fluxo do lançamento, que eram botões em código da tela fixa. Cada um é um
 * workflow de três passos — Montar Objeto com os campos a gravar → Gravar Registro → resposta com a
 * mensagem e `actions: ['refresh']` — e uma Action que diz QUANDO aparece, por expressão sobre o
 * próprio registro. Nada aqui é específico do kernel.
 *
 * `idExpression` é o único ponto que muda quando o mesmo gesto é oferecido de OUTRA tela: na
 * listagem de lançamentos o registro da ação é o próprio lançamento (`event.recordId`); no cartão da
 * agenda é o item do calendário, e o lançamento está no `origemId` dele.
 */
const flowWorkflow = (
  templateId: string,
  name: string,
  description: string,
  fields: { name: string; expression?: string; value?: unknown }[],
  message: string,
  idExpression = 'event.recordId',
): WorkflowModuleTemplate => ({
  templateId,
  name,
  description,
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
            name: 'lancamento',
            fields: [
              { name: 'id', value: { kind: 'Expression', expression: idExpression } },
              ...fields.map((field) => ({
                name: field.name,
                value: field.expression
                  ? { kind: 'Expression', expression: field.expression }
                  : { kind: 'Literal', value: field.value },
              })),
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
        upsert: { kind: 'Literal', value: { table: 'financials', source: 'input', property: 'lancamento' } },
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
              { name: 'status', value: { kind: 'Literal', value: message } },
              { name: 'actions', value: { kind: 'Literal', value: ['refresh'] } },
            ],
          },
        },
      },
    },
  ],
});

const PAGAR_WORKFLOW = flowWorkflow(
  'wf-financeiro-pagar',
  'Registrar pagamento',
  'Marca o lançamento como Pago e carimba a data de pagamento de hoje.',
  [
    { name: 'status', value: 'Pago' },
    { name: 'paymentDate', expression: 'today()' },
  ],
  'Pagamento registrado.',
);

const ESTORNAR_WORKFLOW = flowWorkflow(
  'wf-financeiro-estornar',
  'Estornar pagamento',
  'Devolve o lançamento para Aberto e limpa a data de pagamento.',
  [
    { name: 'status', value: 'Aberto' },
    { name: 'paymentDate', value: null },
  ],
  'Pagamento estornado.',
);

const CANCELAR_WORKFLOW = flowWorkflow(
  'wf-financeiro-cancelar',
  'Registrar cancelamento',
  'Marca o lançamento como Cancelado e carimba a data de cancelamento de hoje.',
  [
    { name: 'status', value: 'Cancelado' },
    { name: 'cancelDate', expression: 'today()' },
  ],
  'Cancelamento registrado.',
);

/**
 * ─── O lançamento na AGENDA ───────────────────────────────────────────────────────────────────
 *
 * O Calendário não sabe o que é um lançamento, e não vai saber: ele apresenta itens de uma entidade
 * própria (`calendar`), e quem põe um item lá continua dono dele. Toda a integração abaixo é do
 * Financeiro, e é a MESMA anatomia que o Prazo estreou — de propósito, porque é assim que a terceira
 * extensão a fazer isso não precisa inventar nada:
 *
 * | Peça | O que faz |
 * |---|---|
 * | complemento de tela | acrescenta ao item a situação, o valor e a pessoa — que viram filtro |
 * | dois workflows de espelho | `financial.saved` mantém o item em dia, `financial.deleted` o remove |
 * | um mutirão | põe na agenda os lançamentos anteriores à instalação, sem duplicar |
 * | duas actions | registrar pagamento pelo cartão, e remarcar ao arrastar para outro dia |
 * | uma contribuição | diz à agenda que o arrasto de um item de origem `financials` tem resposta |
 *
 * O par que endereça o lançamento é `origem: 'financials'` + `origemId`.
 */
const CALENDAR_SOURCE_ID = 'microteia:calendar';
const CALENDAR_COLLECTION = 'calendar';

/**
 * O que o Financeiro acrescenta ao item do calendário. As chaves são as DELE — `financialStatus`,
 * e não `status`; `financialPersonId`, e não `personId` — e isso não é preciosismo: o complemento
 * substitui na tela alvo o campo de mesma chave, e a desinstalação leva embora o que é seu. Duas
 * extensões disputando `personId` na agenda fariam a saída de uma apagar o filtro da outra, num
 * escritório que não mexeu em nada. Numa tela compartilhada, a chave é de quem a declarou.
 *
 * A situação vem junto porque não é só filtro: é ela que diz ao gesto de arrasto QUAL data mudar —
 * a agenda só sabe "pendente" ou "concluído", e um lançamento cancelado é concluído para ela.
 */
const CALENDAR_PATCH: ScreenPatchTemplate = {
  target: CALENDAR_SOURCE_ID,
  targetKind: 'sourceId',
  // O gesto de pagar entra na MESMA lista que o escritório edita no Form Design da agenda ("Ações do
  // card na listagem"): instalar já o deixa no cartão, e quem quiser tirá-lo ou reordená-lo faz isso
  // pela tela de sempre.
  cardActionIds: ['act-financeiro-calendar-pagar'],
  fields: [
    { key: 'financialStatus', label: 'Situação do lançamento', type: 'select', required: false, order: 30, section: 'Financeiro', lookupCollection: 'financialStatuses', optionsColored: true, filterable: true },
    { key: 'financialAmount', label: 'Valor', type: 'currency', required: false, order: 31, section: 'Financeiro', showInList: true, listIcon: 'moneyDollar', listOrder: 20 },
    { key: 'financialPersonId', label: 'Pessoa do lançamento', type: 'reference', required: false, order: 32, section: 'Financeiro', refEntity: 'persons', filterable: true, showInList: true, listIcon: 'team', listOrder: 21 },
  ],
};

/**
 * A situação do lançamento é um RÓTULO do escritório, e a lista aceita rótulos novos
 * (`optionsAllowUserAdd`). Por isso a tradução pergunta pelo que ENCERRA, e não pelo que está
 * aberto: uma situação que o escritório invente amanhã ("Parcialmente pago") nasce pendente e
 * continua visível na agenda, em vez de sumir dela como concluída.
 */
const statusExpr = (lancamento: string): string =>
  `${lancamento}.status == "Pago" or ${lancamento}.status == "Cancelado" ? "closed" : "pending"`;

/**
 * A prioridade da agenda é, na prática, a FAIXA COLORIDA do cartão e a legenda que filtra por ela.
 * Um lançamento não tem prioridade; o que se lê à distância é se o dinheiro entra ou sai — daí
 * Receita em "baixa" (verde) e Despesa em "alta". É uma tradução do Financeiro, como a do Prazo, e
 * não um significado que a agenda passe a conhecer.
 */
const priorityExpr = (lancamento: string): string =>
  `${lancamento}.type == "Despesa" ? "high" : "low"`;

/**
 * O valor vai com SINAL — despesa negativa —, que é como o próprio cartão do Financeiro já o lê
 * ("- R$ 1.000,00"). Sem isso o item da agenda mostraria "R$ 1.000,00" para uma conta a pagar e
 * para um honorário a receber, e nada no cartão os distinguiria. `0 - valor` em vez de `-valor`
 * porque o menos unário sobre campo ausente devolveria `NaN` em silêncio.
 */
const amountExpr = (lancamento: string): string =>
  `${lancamento}.type == "Despesa" ? 0 - ${lancamento}.amount : ${lancamento}.amount`;

/**
 * O valor de um filtro vai como EXPRESSÃO, e não como `{ kind: 'Event' }`, embora o motor resolva os
 * dois: o construtor de consulta do Form Design só oferece "Valor fixo" e "Expressão", e um mapping
 * `Event` apareceria ali como "Valor fixo" vazio — o escritório leria uma mentira, e o primeiro
 * toque na linha apagaria o filtro.
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
 * "Não achou nada" é uma EXPRESSÃO, não uma comparação de campo: o seletor de campo da comparação só
 * oferece os campos do EVENTO, e o caminho apareceria marcado em vermelho como se estivesse errado.
 * Note o singular — a comparação enxerga o contexto cru (`outputs`), a expressão enxerga o escopo
 * publicado para ela (`output`).
 */
const naoEncontrou = (stepId: string): Condition => ({
  kind: 'Expression',
  expression: `output.${stepId}.count < 1`,
});

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
 * "Já existe item para este lançamento?" — a pergunta que torna o espelho IDEMPOTENTE. Os dois ramos
 * publicam a mesma chave (`input.itemId`): o passo que monta o item não sabe por qual caminho o
 * fluxo passou, e o Gravar Registro inclui quando ela é nula e atualiza quando não é. Ler
 * `output.<busca>.first.id` direto pareceria mais curto e quebraria na primeira vez — sem item,
 * `first` é nulo.
 */
const acharItem = (busca: string, order: number, lancamentoIdExpr: string): WorkflowStep[] => [
  buscar(busca, order, CALENDAR_COLLECTION, 'origemId', lancamentoIdExpr),
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

/**
 * O item da agenda montado a partir de um lançamento. O `lancamento` é o CAMINHO de onde ele vem —
 * `event` quando o gatilho é a gravação, `output.cadaLancamento` quando é a repetição do mutirão.
 *
 * Ser um construtor só, e não duas declarações parecidas, é o que garante que as duas portas gravem
 * o MESMO item: um campo acrescentado aqui aparece nas duas, e um esquecido não some só de uma.
 *
 * O item aparece no dia do VENCIMENTO, e a agenda o desloca sozinha para o dia da conclusão quando
 * ele está encerrado — daí `finishDate` ser a data do pagamento, ou a do cancelamento quando o
 * lançamento foi cancelado sem ter sido pago.
 */
const montarItem = (id: string, order: number, lancamento: string): WorkflowStep => ({
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
          { name: 'title', value: { kind: 'Expression', expression: `${lancamento}.category` } },
          { name: 'status', value: { kind: 'Expression', expression: statusExpr(lancamento) } },
          { name: 'priority', value: { kind: 'Expression', expression: priorityExpr(lancamento) } },
          { name: 'date', value: { kind: 'Expression', expression: `${lancamento}.dueDate` } },
          { name: 'finishDate', value: { kind: 'Expression', expression: `coalesce(${lancamento}.paymentDate, ${lancamento}.cancelDate)` } },
          { name: 'description', value: { kind: 'Expression', expression: `${lancamento}.notes` } },
          { name: 'origem', value: { kind: 'Literal', value: 'financials' } },
          { name: 'origemId', value: { kind: 'Expression', expression: `${lancamento}.id` } },
          { name: 'financialStatus', value: { kind: 'Expression', expression: `${lancamento}.status` } },
          { name: 'financialAmount', value: { kind: 'Expression', expression: amountExpr(lancamento) } },
          { name: 'financialPersonId', value: { kind: 'Expression', expression: `${lancamento}.personId` } },
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
 * O ESPELHO. Roda a cada gravação de lançamento e deixa o item da agenda igual a ele — criando-o na
 * primeira vez, atualizando-o depois.
 */
const CALENDAR_SYNC_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-financeiro-calendar-sync',
  name: 'Espelhar lançamento no calendário',
  description: 'Mantém na agenda um item para cada lançamento: cria na primeira gravação e atualiza nas seguintes.',
  eventName: 'financial.saved',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [
    ...acharItem('buscarItem', 0, 'event.id'),
    montarItem('montarItem', 2, 'event'),
    gravarItem('gravarItem', 3),
  ],
};

/**
 * O MUTIRÃO — o espelho aplicado a quem já existia. O gatilho de gravação só alcança o lançamento
 * salvo depois da instalação; este workflow traz para a agenda os que já estavam no escritório, e
 * pode ser chamado quantas vezes se quiser.
 *
 * **Rodar de novo não duplica nada** porque cada iteração faz a MESMA pergunta do espelho — existe
 * item com este `origemId`? — antes de gravar. Duas execuções seguidas produzem exatamente o mesmo
 * resultado; a segunda apenas reescreve os itens com os valores que eles já tinham.
 *
 * **Por que a situação é um parâmetro, e não "todos de uma vez".** O Step de consulta varre no
 * máximo 300 documentos e devolve no máximo 100 — teto do motor, não desta declaração. Só o operador
 * de igualdade é resolvido no SERVIDOR: filtrar por situação faz a varredura acontecer dentro
 * daquela fatia, em vez de nos 300 primeiros lançamentos do escritório inteiro. E é também o que
 * torna o mutirão útil na prática: o que interessa na agenda é o que está em aberto.
 */
const CALENDAR_BACKFILL_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-financeiro-calendar-sincronizar',
  name: 'Sincronizar lançamentos no calendário',
  description:
    'Põe na agenda os lançamentos que já existiam antes da integração. Pode ser executado quantas'
    + ' vezes for preciso: cada lançamento tem no máximo um item, e rodar de novo apenas o atualiza.'
    + ' Processa até 100 lançamentos por execução, dentro da situação escolhida.',
  eventName: 'workflow.called',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  parameters: [
    {
      key: 'status',
      label: 'Situação dos lançamentos a sincronizar',
      type: 'lookup',
      lookupCollection: 'financialStatuses',
      required: true,
      defaultValue: 'Aberto',
    },
  ],
  steps: [
    {
      id: 'buscarLancamentos',
      stepDefinitionId: 'query',
      type: 'Action',
      order: 0,
      enabled: true,
      configuration: {
        query: {
          kind: 'Literal',
          value: {
            table: 'financials',
            where: [{ path: 'status', op: 'eq', value: { kind: 'Expression', expression: 'event.status' } }],
            orderBy: [{ path: 'dueDate', dir: 'desc' }],
            limit: 100,
            projections: [],
          },
        },
      },
    },
    {
      id: 'cadaLancamento',
      stepDefinitionId: '',
      type: 'Loop',
      order: 1,
      enabled: true,
      configuration: {},
      loop: {
        source: { kind: 'Expression', expression: 'output.buscarLancamentos.results' },
        itemName: 'lancamento',
        outputName: 'itens',
        // Dentro do corpo, o lançamento da vez é `output.cadaLancamento` — o nó de repetição publica
        // o item corrente sob a própria chave, e as saídas do corpo são zeradas a cada volta.
        body: [
          ...acharItem('buscarItem', 0, 'output.cadaLancamento.id'),
          montarItem('montarItem', 2, 'output.cadaLancamento'),
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
              { name: 'sincronizados', value: { kind: 'Expression', expression: 'output.buscarLancamentos.count' } },
              {
                name: 'status',
                value: {
                  kind: 'Expression',
                  expression:
                    'output.buscarLancamentos.count >= 100'
                    + ' ? "Sincronizados 100 lançamentos — o teto de uma execução. Rode de novo para alcançar os demais."'
                    + ' : concat("Sincronizados ", output.buscarLancamentos.count, " lançamento(s) no calendário.")',
                },
              },
            ],
          },
        },
      },
    },
  ],
};

/** Lançamento excluído, item fora da agenda. Sem item, o fluxo encerra — não há o que excluir. */
const CALENDAR_REMOVE_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-financeiro-calendar-remover',
  name: 'Retirar lançamento do calendário',
  description: 'Exclui da agenda o item do lançamento que foi removido.',
  eventName: 'financial.deleted',
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

/**
 * Registrar pagamento pelo cartão da agenda. É o MESMO gesto da listagem de Financeiro, declarado
 * pelo mesmo construtor — muda só de onde vem o id: aqui o registro da ação é o item do calendário,
 * e o lançamento está no `origemId` dele.
 *
 * Ele grava no LANÇAMENTO, nunca no item: quem atualiza a agenda é o espelho, na sequência.
 * Escrever direto no item deixaria a agenda dizendo "concluído" sobre uma conta que continua aberta.
 */
const CALENDAR_PAGAR_WORKFLOW = flowWorkflow(
  'wf-financeiro-calendar-pagar',
  'Registrar pagamento pela agenda',
  'Marca como Pago o lançamento que deu origem ao item do calendário, com a data de hoje.',
  [
    { name: 'status', value: 'Pago' },
    { name: 'paymentDate', expression: 'today()' },
  ],
  'Pagamento registrado.',
  'event.context.origemId',
);

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
        name: 'lancamento',
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
 * lançamento em aberto que muda de dia foi reagendado (muda o vencimento); um já pago mudou de dia
 * de pagamento; um cancelado, de data de cancelamento. As três datas existem no lançamento, e a
 * situação diz qual delas o cartão está mostrando.
 *
 * É por isso que a situação do lançamento viaja no item: a agenda só conhece "pendente" e
 * "concluído", e pago e cancelado são ambos concluídos para ela — o arrasto de um cancelado
 * carimbaria a data de pagamento se a decisão dependesse só do que a agenda sabe.
 */
const CALENDAR_MOVER_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-financeiro-calendar-mover',
  name: 'Remarcar lançamento pela agenda',
  description: 'Muda o vencimento do lançamento — ou a data de pagamento, ou a de cancelamento, conforme a situação dele — quando o item é arrastado para outro dia.',
  eventName: 'workflow.called',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  parameters: [
    { key: 'targetDate', label: 'Novo dia', type: 'Date', required: true },
  ],
  steps: [
    {
      id: 'jaPago',
      stepDefinitionId: '',
      type: 'Condition',
      order: 0,
      enabled: true,
      condition: { kind: 'Expression', expression: 'event.context.financialStatus == "Pago"' },
      configuration: {},
      branches: {
        whenTrue: [remarcar('remarcarPagamento', 0, 'paymentDate')],
        whenFalse: [
          {
            id: 'jaCancelado',
            stepDefinitionId: '',
            type: 'Condition',
            order: 0,
            enabled: true,
            condition: { kind: 'Expression', expression: 'event.context.financialStatus == "Cancelado"' },
            configuration: {},
            branches: {
              whenTrue: [remarcar('remarcarCancelamento', 0, 'cancelDate')],
              whenFalse: [remarcar('remarcarVencimento', 0, 'dueDate')],
            },
          },
        ],
      },
    },
    {
      id: 'gravar',
      stepDefinitionId: 'upsert',
      type: 'Action',
      order: 1,
      enabled: true,
      configuration: {
        upsert: { kind: 'Literal', value: { table: 'financials', source: 'input', property: 'lancamento' } },
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
              { name: 'status', value: { kind: 'Literal', value: 'Lançamento remarcado.' } },
              { name: 'actions', value: { kind: 'Literal', value: ['refresh'] } },
            ],
          },
        },
      },
    },
  ],
};

const ACTIONS: ActionModuleTemplate[] = [
  {
    templateId: 'act-financeiro-pagar',
    key: 'financeiro_pagar',
    title: 'Registrar pagamento',
    icon: 'checkboxCircle',
    workflowId: 'wf-financeiro-pagar',
    // O gesto só existe enquanto há o que pagar — registro novo ainda não tem status gravado.
    hiddenWhen: 'isNew or status != "Aberto"',
    danger: false,
    enabled: true,
    order: 0,
  },
  {
    templateId: 'act-financeiro-estornar',
    key: 'financeiro_estornar',
    title: 'Estornar pagamento',
    icon: 'history',
    workflowId: 'wf-financeiro-estornar',
    hiddenWhen: 'isNew or status != "Pago"',
    danger: false,
    enabled: true,
    order: 1,
  },
  {
    templateId: 'act-financeiro-cancelar',
    key: 'financeiro_cancelar',
    title: 'Registrar cancelamento',
    icon: 'closeCircle',
    workflowId: 'wf-financeiro-cancelar',
    hiddenWhen: 'isNew or status == "Cancelado"',
    danger: true,
    enabled: true,
    order: 2,
  },
  {
    templateId: 'act-financeiro-calendar-pagar',
    key: 'financeiro_calendar_pagar',
    title: 'Registrar pagamento',
    icon: 'checkboxCircle',
    workflowId: 'wf-financeiro-calendar-pagar',
    /**
     * A expressão é avaliada sobre o ITEM DA AGENDA, não sobre o lançamento — é o registro do cartão
     * em que o gesto aparece. Daí `financialStatus`, o campo que o complemento acrescentou, e não
     * `status`, que ali é a situação da agenda. A primeira metade é o que mantém o gesto restrito
     * aos itens do Financeiro: a mesma lista serve a agenda inteira, e sem ela o botão apareceria no
     * item de qualquer outra extensão.
     */
    hiddenWhen: 'origem != "financials" or financialStatus != "Aberto"',
    danger: false,
    enabled: true,
    order: 3,
  },
  {
    templateId: 'act-financeiro-calendar-mover',
    key: 'financeiro_calendar_mover',
    title: 'Remarcar lançamento',
    icon: 'time',
    workflowId: 'wf-financeiro-calendar-mover',
    danger: false,
    enabled: true,
    order: 4,
  },
];

const FINANCEIRO_SCREEN: ScreenModuleTemplate = {
  key: 'financeiro',
  sourceId: SOURCE_ID,
  sourceRev: 2,
  titleSingular: 'Lançamento',
  titlePlural: 'Financeiro',
  icon: 'moneyDollar',
  dataCollection: 'financials',
  fields: FIELDS,
  titleFieldKey: 'category',
  subtitleFieldKey: 'type',
  hasNotes: false,
  hasDocuments: true,
  hasTags: true,
  tagCollection: 'financialTags',
  // Os eventos que as automações escutam continuam sendo `financial.saved`/`financial.deleted`.
  eventPrefix: 'financial',
  // A mesma permissão da regra nomeada que `financials` tinha: secretária lê, advogado e admin gravam.
  writeRoles: ['admin', 'lawyer'],
  listActions: ['copyLink', 'clone', 'manageTags', 'delete'],
  viewActionIds: ['act-financeiro-pagar', 'act-financeiro-estornar', 'act-financeiro-cancelar'],
  cardActionIds: ['act-financeiro-pagar', 'act-financeiro-estornar', 'act-financeiro-cancelar'],
  // O menu e a página vêm das contribuições da extensão, que apontam para a view própria.
  sidebarOrder: 0,
  hideFromSidebar: true,
};

/**
 * A listagem. Do padrão vêm filtros (inclusive o período de vencimento, que agora é um filtro de
 * data como outro qualquer), etiquetas, ações do cartão e os modais; a view injeta o que é do
 * Financeiro: a faixa de totais sobre os registros FILTRADOS, o valor com sinal e cor no cartão e a
 * linha que compõe as três datas.
 */
const FINANCEIRO_SOURCE = `
import { useMemo, useState } from 'react';
import { styled, useTheme } from 'styled-components';
import { RecordListSurface, Badge, Button, InfoBanner } from '@microteia/ui';
import { useEntityList, useLookup } from '@microteia/data';
import { getConfigColor } from '@microteia/theme';
import { formatCurrencyBRL, formatDate } from '@microteia/format';

const SOURCE_ID = 'microteia:financeiro';

const Header = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.xs};
\`;

const Totals = styled.div\`
  display: flex;
  flex-wrap: wrap;
  gap: \${({ theme }) => theme.spacing.lg};
  padding: \${({ theme }) => theme.spacing.sm + ' ' + theme.spacing.xl};
  border-bottom: 1px solid \${({ theme }) => theme.colors.border};
  background: \${({ theme }) => theme.colors.surface};
\`;

const Total = styled.div\`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
\`;

const TotalLabel = styled.span\`
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: \${({ theme }) => theme.colors.textMuted};
\`;

const TotalValue = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.md};
  font-weight: 700;
  font-family: \${({ theme }) => theme.fonts.mono};
  color: \${({ $color, theme }) => $color || theme.colors.text};
\`;

const CardRow = styled.div\`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: \${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
\`;

const Amount = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.md};
  font-weight: 700;
  font-family: \${({ theme }) => theme.fonts.mono};
  color: \${({ $color }) => $color};
  white-space: nowrap;
\`;

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const endOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
};

const iso = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
};

// O mês corrente é a visão útil de quem abre o Financeiro: sem isso, a primeira tela é o histórico
// inteiro do escritório.
const MES_CORRENTE = [
  { key: 'dueDate', values: [iso(startOfMonth())] },
  { key: 'dueDate:ate', values: [iso(endOfMonth())] },
];

const sum = (records, type, status) => records
  .filter((r) => r.type === type && r.status === status)
  .reduce((total, r) => total + (Number(r.amount) || 0), 0);

export default function FinanceiroView() {
  const theme = useTheme();
  const list = useEntityList(SOURCE_ID, { defaultFilterTokens: MES_CORRENTE });
  const statusOptions = useLookup('financialStatuses');
  const typeOptions = useLookup('financialTypes');
  const [showTotals, setShowTotals] = useState(true);

  const totals = useMemo(() => {
    const records = list.filteredRecords;
    const recebido = sum(records, 'Receita', 'Pago');
    const pago = sum(records, 'Despesa', 'Pago');
    const aReceber = sum(records, 'Receita', 'Aberto');
    const aPagar = sum(records, 'Despesa', 'Aberto');
    return { recebido, pago, saldo: recebido - pago, aReceber, aPagar, previsto: recebido - pago - aReceber - aPagar };
  }, [list.filteredRecords]);

  if (!list.definition) {
    return <div style={{ padding: '24px' }}><InfoBanner message='Tela "Financeiro" não encontrada. Instale a extensão para ativá-la.' variant="warning" /></div>;
  }

  const amountColor = (record) => record.type === 'Despesa' ? theme.colors.expense : theme.colors.revenue;

  const statusColor = (record) => {
    // A data chega como Date (o store converte o Timestamp): comparar pelo DIA, no fuso do
    // escritório. Comparar como texto não funciona: String(new Date()) é "Wed Aug 12 2026".
    const vencido = record.status === 'Aberto' && record.dueDate && iso(new Date(record.dueDate)) < iso(new Date());
    return vencido ? theme.colors.danger : getConfigColor(statusOptions, record.status, theme);
  };

  const renderBelowHeader = (record) => (
    <CardRow>
      <Badge color={statusColor(record)}>{record.status}</Badge>
      <Amount $color={amountColor(record)}>
        {record.type === 'Despesa' ? '-' : '+'} {formatCurrencyBRL(Number(record.amount) || 0)}
      </Amount>
    </CardRow>
  );

  // As três datas numa linha só: separadas, "12/08 · 15/08" vira duas linhas que não se explicam.
  const renderMetaRows = (record) => {
    const parts = [formatDate(record.dueDate)];
    if (record.paymentDate) parts.push('pago em ' + formatDate(record.paymentDate));
    if (record.cancelDate) parts.push('cancelado em ' + formatDate(record.cancelDate));
    return [{ key: 'datas', value: parts.filter(Boolean).join(' · ') }];
  };

  const total = (label, value, color) => (
    <Total>
      <TotalLabel>{label}</TotalLabel>
      <TotalValue $color={color}>{formatCurrencyBRL(value)}</TotalValue>
    </Total>
  );

  const summary = showTotals ? (
    <Totals>
      {total('Recebido', totals.recebido, theme.colors.revenue)}
      {total('Pago', totals.pago, theme.colors.expense)}
      {total('Saldo', totals.saldo, totals.saldo < 0 ? theme.colors.expense : theme.colors.revenue)}
      {total('A receber', totals.aReceber, theme.colors.textSecondary)}
      {total('A pagar', totals.aPagar, theme.colors.textSecondary)}
      {total('Previsto', totals.previsto, totals.previsto < 0 ? theme.colors.expense : theme.colors.revenue)}
    </Totals>
  ) : null;

  const headerActions = (
    <Header>
      <Button variant="ghost" onClick={() => setShowTotals((prev) => !prev)}>
        {showTotals ? 'Ocultar totais' : 'Mostrar totais'}
      </Button>
    </Header>
  );

  return (
    <RecordListSurface
      vm={list}
      definition={list.definition}
      renderBelowHeader={renderBelowHeader}
      renderMetaRows={renderMetaRows}
      headerActions={headerActions}
      summary={summary}
      emptyTitle="Nenhum lançamento encontrado"
      emptyActionLabel="Cadastrar primeiro lançamento"
    />
  );
}
`;

/**
 * O STARTUP: comandos de ⌘K e a menção `@lancamento` das anotações — o que era um provider do
 * kernel. A tela é resolvida pelo `sourceId`, então acompanha a chave instalada.
 */
const STARTUP_SOURCE = `
import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:financeiro';
const LIST_KEY = 'financeiro';
const GROUP = 'Financeiro';

const viewKey = (screen, id) => 'view-dyn:' + screen.id + ':' + id;

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

/**
 * A busca casa só o TÍTULO (a categoria). O subtítulo do lançamento é o TIPO ("Receita"/"Despesa"),
 * uma classificação que todo registro repete: casá-la devolveria metade do financeiro para quem
 * digitasse "rec". Quem inclui o subtítulo é Processos, onde ele é o NÚMERO do processo.
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
      const icon = <Icon name="moneyDollar" size={16} />;
      const items = [];
      if ('novo lancamento'.indexOf(q) !== -1 || 'novo lançamento'.indexOf(q) !== -1) {
        items.push({ id: 'financeiro:new', title: 'Novo lançamento', group: GROUP, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if ('abrir financeiro'.indexOf(q) !== -1) {
        items.push({ id: 'financeiro:list', title: 'Abrir Financeiro', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, screen, q)) continue;
        items.push({
          id: 'financeiro:' + r.id,
          title: textOf(r, screen.titleFieldKey),
          subtitle: textOf(r, screen.subtitleFieldKey) || 'Lançamento',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab(viewKey(screen, r.id)); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'lancamento',
    label: 'Lançamento',
    description: 'Inserir link para um lançamento financeiro',
    icon: 'moneyDollar',
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
          subtitle: textOf(record, screen.subtitleFieldKey) || 'Lançamento',
          tabKey: viewKey(screen, record.id),
        }));
    },
  });
}
`;


/**
 * O WIDGET do Dashboard: o que há para receber e para pagar dentro de um horizonte de dias. Era o
 * cartão "Financeiro" do painel escrito no kernel — inclusive o seletor de 7/15/30 dias —, e agora é
 * desta extensão, a única que sabe o que é uma receita em aberto.
 */
const FINANCEIRO_RESUMO_SOURCE = `
import { useMemo, useState } from 'react';
import { styled, useTheme } from 'styled-components';
import { Button } from '@microteia/ui';
import { useCollection, useOpenScreenList } from '@microteia/data';
import { formatCurrencyBRL } from '@microteia/format';

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
  flex-wrap: wrap;
\`;

const Title = styled.h3\`
  font-size: \${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  color: \${({ theme }) => theme.colors.text};
\`;

const Periods = styled.div\`
  display: flex;
  gap: 2px;
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.md};
  padding: 2px;
\`;

const Period = styled.button\`
  border: none;
  border-radius: \${({ theme }) => theme.borderRadius.sm};
  padding: \${({ theme }) => theme.spacing.xs} \${({ theme }) => theme.spacing.sm};
  font-size: \${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  cursor: pointer;
  background: \${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  color: \${({ $active, theme }) => ($active ? theme.colors.white : theme.colors.textSecondary)};
\`;

const Row = styled.div\`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: \${({ theme }) => theme.spacing.sm} 0;
  border-bottom: 1px solid \${({ theme }) => theme.colors.border};
  &:last-child { border-bottom: none; }
\`;

const RowLabel = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.sm};
  color: \${({ theme }) => theme.colors.textMuted};
\`;

const RowValue = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.md};
  font-weight: 700;
  font-family: \${({ theme }) => theme.fonts.mono};
  color: \${({ $color }) => $color};
\`;

const PERIODS = [7, 15, 30];
const DAY = 86400000;

const dayTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const isoOf = (time) => {
  const date = new Date(time);
  const pad = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
};

export default function FinanceiroResumoWidget() {
  const theme = useTheme();
  const financials = useCollection('financials');
  const openList = useOpenScreenList();
  const [days, setDays] = useState(30);

  const totals = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const limit = today + days * DAY;
    const open = financials.filter((f) => {
      const due = dayTime(f.dueDate);
      return f.status === 'Aberto' && due !== null && due <= limit;
    });
    const sum = (type) => open
      .filter((f) => f.type === type)
      .reduce((total, f) => total + (Number(f.amount) || 0), 0);
    const receber = sum('Receita');
    const pagar = sum('Despesa');
    return { receber, pagar, saldo: receber - pagar, limit };
  }, [financials, days]);

  return (
    <Card>
      <Head>
        <Title>Financeiro</Title>
        <Head>
          <Periods>
            {PERIODS.map((option) => (
              <Period key={option} $active={days === option} onClick={() => setDays(option)}>{option}d</Period>
            ))}
          </Periods>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openList('financials', [
              { key: 'status', values: ['Aberto'] },
              { key: 'dueDate:ate', values: [isoOf(totals.limit)] },
            ])}
          >
            Ver tudo
          </Button>
        </Head>
      </Head>
      <div>
        <Row>
          <RowLabel>Receitas a receber</RowLabel>
          <RowValue $color={theme.colors.revenue}>{formatCurrencyBRL(totals.receber)}</RowValue>
        </Row>
        <Row>
          <RowLabel>Despesas a pagar</RowLabel>
          <RowValue $color={theme.colors.expense}>{formatCurrencyBRL(totals.pagar)}</RowValue>
        </Row>
        <Row>
          <RowLabel>Saldo projetado</RowLabel>
          <RowValue $color={totals.saldo >= 0 ? theme.colors.revenue : theme.colors.expense}>
            {formatCurrencyBRL(totals.saldo)}
          </RowValue>
        </Row>
      </div>
    </Card>
  );
}
`;

export const financeiroPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.financeiro',
    version: '1.2.0',
    kernel: '^1.0.0',
    // O índice que a automação desta extensão exige: a consulta casa `status` com ordenação por
    // `dueDate`, e no Firestore igualdade + ordenação por outro campo pede índice composto. Ele é
    // DESTA extensão — um escritório que não a instala não recebe o índice.
    backend: {
      indexes: [
        {
          collectionGroup: 'financials',
          queryScope: 'COLLECTION',
          fields: [
            { fieldPath: 'status', order: 'ASCENDING' },
            { fieldPath: 'dueDate', order: 'DESCENDING' },
          ],
        },
      ],
    },
    name: 'Financeiro',
    description: 'Os lançamentos financeiros do escritório recriados como extensão, sobre os MESMOS lançamentos — a quarta entidade a sair do kernel.',
    publisher: { name: 'Microteia' },
    // O lançamento aponta para pessoa, processo e contrato: as três coleções vêm das extensões que
    // as declaram, e é por isso que as três precisam estar instaladas.
    dependencies: {
      'core.ui': '^1.0.0',
      'com.microteia.pessoa': { version: '^1.0.0', collections: ['persons'] },
      'com.microteia.contrato': { version: '^1.0.0', collections: ['contracts'] },
      'com.microteia.processo': { version: '^2.0.0', collections: ['cases'] },
      // O lançamento se mostra na agenda, e a agenda é de outra extensão: sem ela, a coleção
      // `calendar` não existe e o espelho gravaria no vazio.
      'com.microteia.calendar': { version: '^1.0.0', collections: ['calendar'] },
    },
    contributes: [
      nav({ key: 'financeiro', label: 'Financeiro', icon: 'moneyDollar', order: 70 }),
      page({ key: 'financeiro', title: 'Financeiro', icon: 'moneyDollar' }, 'financeiro'),
      surfaceWidget({ surface: 'dashboard', key: 'financeiro.resumo', title: 'Resumo financeiro', description: 'O que há a receber e a pagar no horizonte escolhido, e o saldo projetado.', icon: 'moneyDollar', defaultSpan: 1, order: 70 }, 'widget-financeiro-resumo'),
      // O gesto de ARRASTO. É o único que precisa de contribuição: o de pagar vai pela lista de ações
      // da tela (ver `CALENDAR_PATCH`), porque lá existe a lista equivalente — para "mudar de dia"
      // não existe. A `origem` é o que faz a agenda oferecê-lo só aos itens de lançamento; o
      // `actionSourceId` é o endereço estável da Action, já que o id real só nasce na instalação.
      pointContribution('calendar.moveaction', 'financeiro-mover', {
        key: 'financeiro.mover',
        title: 'Remarcar o lançamento',
        description: 'Arrastar um lançamento para outro dia muda o vencimento — ou a data de pagamento ou de cancelamento, conforme a situação dele.',
        icon: 'moneyDollar',
        order: 0,
        origem: 'financials',
        actionSourceId: 'act-financeiro-calendar-mover',
      }),
    ],
  },
  summary:
    'O controle financeiro do escritório: receitas e despesas com categoria, valor, vencimento, pagamento, forma, centro de custo e nota, vinculadas a pessoa, processo e contrato — com etiquetas, documentos, os gestos de registrar pagamento, estornar e cancelar, e cada lançamento aparecendo no Calendário no dia em que vence.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'A extensão **Financeiro** traz os lançamentos do escritório: cada receita ou despesa com categoria, valor, vencimento e status, ligada à pessoa, ao processo e ao contrato de origem.\n\nA listagem abre no mês corrente e mostra os totais do que está filtrado — recebido, pago, saldo e o previsto do que ainda está em aberto. Registrar pagamento, estornar e registrar cancelamento são gestos do próprio cartão.\n\nCada lançamento aparece também no **Calendário**, no dia em que vence — e, depois de pago, no dia do pagamento. O valor aparece no cartão com sinal, receitas em verde e despesas em roxo; registrar o pagamento é um gesto do próprio cartão da agenda, e arrastá-lo para outro dia remarca o lançamento. Para os lançamentos que já existiam antes de instalar, rode a automação "Sincronizar lançamentos no calendário".\n\nAs listas de Categoria, Status e Forma de Pagamento já vêm preenchidas e são suas; o Centro de Custo é o mesmo dos Contratos.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Financeiro" no menu' },
          { label: 'Cadastro', value: '14 campos, em 4 seções' },
          { label: 'Por lançamento', value: 'Etiquetas e documentos' },
          { label: 'No Calendário', value: 'Um item por lançamento, no dia do vencimento' },
          { label: 'Quem grava', value: 'Advogado e administrador' },
        ],
      },
      {
        type: 'banner',
        message: 'Remover a extensão remove a tela, nunca os lançamentos: os registros, as listas de opções e as etiquetas continuam no escritório e voltam a aparecer se ela for instalada de novo.',
        variant: 'info',
      },
    ],
  },
  workflows: [
    PAGAR_WORKFLOW,
    ESTORNAR_WORKFLOW,
    CANCELAR_WORKFLOW,
    CALENDAR_SYNC_WORKFLOW,
    CALENDAR_BACKFILL_WORKFLOW,
    CALENDAR_REMOVE_WORKFLOW,
    CALENDAR_PAGAR_WORKFLOW,
    CALENDAR_MOVER_WORKFLOW,
  ],
  actions: ACTIONS,
  screens: [FINANCEIRO_SCREEN],
  screenPatches: [CALENDAR_PATCH],
  lookups: LOOKUPS,
  tagLists: [{ collection: 'financialTags', label: 'Etiquetas: Financeiro' }],
  startup: STARTUP_SOURCE,
  views: [
    {
      key: 'financeiro',
      title: 'Financeiro',
      icon: 'moneyDollar',
      source: FINANCEIRO_SOURCE,
    },
    { key: 'widget-financeiro-resumo', title: 'Resumo financeiro', icon: 'moneyDollar', source: FINANCEIRO_RESUMO_SOURCE },
  ],
};
