import type {
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption } from '../../domain/entities';
import type { ExtensionPointDefinition } from '../../domain/schema/plugin/extensionPoint';
import { nav, page, settingsSection } from '../contributionBuilders';
import CALENDAR_SOURCE from './views/calendar/Calendar.view.tsx?raw';

/**
 * **Calendário** — a agenda do escritório, agnóstica. Era a última tela de código do kernel a
 * conhecer uma entidade de negócio: lia prazos, escrevia prazos e sabia o que era "vencido",
 * "concluído" e "prioridade crítica". Aqui ela não sabe o que apresenta.
 *
 * O que ela conhece é UMA entidade própria — `calendar` —, cujo único propósito é aparecer na
 * agenda. Quem tem data a mostrar (um prazo, uma audiência, uma parcela) mantém um item aqui e é
 * responsável por ele: criar, atualizar e excluir quando o registro de origem muda. O calendário
 * nunca escreve no registro de origem, e por isso não precisa saber que ele existe — guarda apenas
 * `origem` (a COLEÇÃO) e `origemId`, e é por esse par que o clique no cartão abre o registro certo.
 *
 * **Os gestos do cartão são configuração da TELA, não deste código.** Eles saem de "Ações do card na
 * listagem" do Form Design da entidade Calendário — a mesma lista que qualquer listagem do sistema
 * usa, e que o escritório edita à vontade. Uma extensão que queira oferecer um gesto acrescenta a
 * Action dela àquela lista pelo complemento de tela; não há ponto de extensão próprio para isso,
 * porque haveria duas origens para a mesma pergunta ("o que aparece neste cartão?") e o usuário só
 * conseguiria mexer numa delas.
 *
 * O único ponto próprio é o do ARRASTO — `calendar.moveaction` —, e ele é próprio porque não tem
 * equivalente em lugar nenhum: nenhuma listagem tem o gesto de "mudar de dia", então não há lista do
 * Form Design onde ele caberia. A contribuição aponta para uma Action do escritório pelo `sourceId`
 * (o `templateId` do pacote que a instalou), o endereço estável já que o id real nasce na
 * instalação. Arrastar não grava nada por conta própria: quem decide o que "mudar de dia" significa
 * é a origem, que pode adiar o prazo, remarcar a audiência ou recusar o movimento.
 */
const SOURCE_ID = 'microteia:calendar';

const CALENDAR_MOVE_POINT = 'calendar.moveaction';

const IDENTIFICACAO = 'Item';
const DATAS = 'Datas';
const ORIGEM = 'Origem';

const FIELDS: TemplateField[] = [
  { key: 'title', label: 'Título', type: 'text', required: true, order: 0, section: IDENTIFICACAO, placeholder: 'O que aparece no cartão' },
  { key: 'status', label: 'Situação', type: 'select', required: true, order: 1, section: IDENTIFICACAO, lookupCollection: 'calendarStatuses', optionsColored: true, filterable: true, placeholder: 'Selecione a situação...' },
  { key: 'priority', label: 'Prioridade', type: 'select', required: true, order: 2, section: IDENTIFICACAO, lookupCollection: 'calendarPriorities', optionsColored: true, filterable: true, placeholder: 'Selecione a prioridade...' },
  { key: 'description', label: 'Descrição', type: 'textarea', required: false, order: 3, section: IDENTIFICACAO, placeholder: 'Detalhe que aparece no cartão' },
  { key: 'date', label: 'Data', type: 'date', required: true, order: 4, section: DATAS, filterable: true },
  { key: 'hour', label: 'Hora', type: 'time', required: false, order: 5, section: DATAS },
  { key: 'finishDate', label: 'Data da conclusão', type: 'date', required: false, order: 6, section: DATAS, filterable: true },
  { key: 'finishHour', label: 'Hora da conclusão', type: 'time', required: false, order: 7, section: DATAS },
  // O par que endereça o registro que mandou o item para cá. `origem` é o nome da COLEÇÃO, não um
  // rótulo: é o que o clique no cartão usa para abrir o registro na tela que o apresenta hoje.
  { key: 'origem', label: 'Coleção de origem', type: 'text', required: true, order: 8, section: ORIGEM, filterable: true, placeholder: 'O cadastro de onde o item veio' },
  { key: 'origemId', label: 'Registro de origem', type: 'text', required: true, order: 9, section: ORIGEM },
];

const colored = (entries: [string, string, string][]): CustomFieldOption[] =>
  entries.map(([key, label, color]) => ({ key, label, color }));

/**
 * As duas listas de partida. As CHAVES são estáveis e em inglês porque quem grava um item é uma
 * automação de outra extensão — ela precisa de um valor que não mude quando o escritório renomeia o
 * rótulo. O que o usuário lê é o `label`, e é dele daqui em diante.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: 'calendarStatuses',
    label: 'Calendário: Situação',
    options: colored([['pending', 'Pendente', 'warning'], ['closed', 'Concluído', 'success']]),
  },
  {
    collection: 'calendarPriorities',
    label: 'Calendário: Prioridade',
    options: colored([
      ['low', 'Baixa', 'success'],
      ['medium', 'Média', 'warning'],
      ['high', 'Alta', 'secondary'],
      ['critical', 'Crítica', 'danger'],
    ]),
  },
];

const CALENDAR_SCREEN: ScreenModuleTemplate = {
  key: 'calendar',
  sourceId: SOURCE_ID,
  sourceRev: 1,
  titleSingular: 'Item do calendário',
  titlePlural: 'Calendário',
  icon: 'calendar',
  fields: FIELDS,
  titleFieldKey: 'title',
  subtitleFieldKey: 'status',
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  eventPrefix: 'calendar',
  /**
   * O item do calendário é um ESPELHO: quem manda nele é o registro de origem, e editá-lo à mão
   * criaria uma verdade paralela que a próxima gravação da origem apaga. Por isso o cartão não
   * oferece gesto de edição e a listagem crua fica fora do menu.
   *
   * `writeRoles: ['admin']` é o mais estreito que a regra do curinga sabe expressar — quem grava de
   * verdade é a automação da origem, pelo servidor, que não passa por esta lista. Deixar o admin de
   * fora também tiraria a única saída para consertar um item órfão de uma sincronização quebrada.
   */
  writeRoles: ['admin'],
  listActions: [],
  sidebarOrder: 0,
  hideFromSidebar: true,
};

const EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: CALENDAR_MOVE_POINT,
    apiVersion: '1.0.0',
    title: 'Ação ao mover um item de dia',
    description: 'A ação executada quando um item é arrastado para outro dia. Quem decide o que a mudança significa é a origem.',
    ownerPluginId: 'com.microteia.calendar',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
];

/**
 * A agenda. Fiel à que existia no kernel — a barra de números, a navegação por mês, as colunas de
 * dia com rolagem horizontal que abre no dia de hoje, o cartão colorido pela prioridade, o arrastar
 * entre dias e a legenda que filtra por prioridade —, com três diferenças que a tornam agnóstica:
 * o dado vem da entidade `calendar`, o filtro é o `CompositeFilter` sobre os campos que a tela
 * declara (inclusive os que outra extensão acrescentou), e todo gesto é uma Action de terceiro.
 */

export const calendarPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.calendar',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Calendário',
    description: 'A agenda do escritório, agnóstica: qualquer extensão põe um item nela e continua dona dele.',
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0' },
    extensionPoints: EXTENSION_POINTS,
    contributes: [
      nav({ key: 'calendar', label: 'Calendário', icon: 'calendar', order: 20 }),
      page({ key: 'calendar', title: 'Calendário', icon: 'calendar' }, 'calendar'),
      settingsSection({
        key: 'calendar',
        title: 'Calendário',
        description: 'Como a agenda responde aos gestos do usuário.',
        icon: 'calendar',
        order: 30,
        properties: [
          {
            key: 'calendar.moveActions',
            label: 'Ao arrastar um item para outro dia',
            description:
              'As ações que respondem à mudança de dia, na ordem em que são consultadas. Vale a primeira que atende a origem do item — arrastar não grava nada por conta própria.',
            type: 'contributions',
            point: CALENDAR_MOVE_POINT,
            default: [],
            scopes: ['tenant'],
          },
        ],
      }),
    ],
  },
  summary:
    'A agenda do escritório em colunas de dia, com o mês inteiro numa rolagem que abre no dia de hoje. Ela não conhece prazo, audiência nem parcela: qualquer extensão registra um item, continua dona dele e diz o que acontece quando o usuário o arrasta para outro dia.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'O **Calendário** mostra, lado a lado, os dias do mês e o que está marcado em cada um. A rolagem abre no dia de hoje, o cartão é colorido pela prioridade e a legenda embaixo filtra por ela num clique.\n\nA agenda não é dona de nada do que mostra. Cada item pertence ao registro que o criou — um prazo, uma audiência, uma parcela — e é esse registro que o mantém em dia: mudou lá, muda aqui; foi excluído lá, some daqui. Por isso o item não se edita pela agenda, e clicar no cartão leva direto ao registro de origem.\n\nArrastar um cartão para outro dia **pergunta** à extensão dona do item o que fazer. Em Configurações › Calendário você escolhe quais respondem e em que ordem.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Calendário" no menu' },
          { label: 'Mostra', value: 'O mês inteiro, em colunas de dia' },
          { label: 'Filtro', value: 'Por situação, prioridade, data — e o que as extensões acrescentarem' },
          { label: 'Arrastar', value: 'Executa a ação que a origem declarou' },
        ],
      },
      {
        type: 'banner',
        message: 'Sozinha, a agenda abre vazia: quem a preenche são as extensões que registram itens nela, como a de Prazos.',
        variant: 'info',
      },
    ],
  },
  workflows: [],
  screens: [CALENDAR_SCREEN],
  lookups: LOOKUPS,
  views: [
    { key: 'calendar', title: 'Calendário', icon: 'calendar', source: CALENDAR_SOURCE },
  ],
};
