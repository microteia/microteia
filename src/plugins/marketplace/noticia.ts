import type {
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption } from '../../domain/entities';
import { nav, page } from '../contributionBuilders';
import NEWS_LIST_SOURCE from './views/noticia/NewsList.view.tsx?raw';
import NEWS_READ_SOURCE from './views/noticia/NewsRead.view.tsx?raw';
import STARTUP_SOURCE from './views/noticia/startup.tsx?raw';

/**
 * **Notícias** — o mural do escritório declarado por extensão: o comunicado que alguém publica, quem
 * já leu, o que cada um guardou para depois e a conversa que se forma embaixo.
 *
 * É a sétima entidade a sair do kernel e a primeira em que o dado importante não é do REGISTRO, e sim
 * da relação entre o registro e QUEM está olhando. Daí as duas capacidades que nasceram com ela: o
 * `user` no escopo das expressões — que é o que faz o selo do menu contar o que EU não li — e o
 * `authorCanDelete`, que devolve por declaração o "cada um apaga o que escreveu" que só existia como
 * regra nomeada de `newsComments` no `firestore.rules`.
 *
 * **O lido/não-lido não tem coleção.** `readBy` e `savedBy` são vetores de id no próprio documento,
 * do mesmo feitio do `likedBy` que a notícia sempre teve. Sem doc por usuário, sem contador a manter:
 * o selo é uma expressão sobre o que a listagem já enxerga, e a leitura de um se resolve numa
 * gravação. O limite é o tamanho do escritório — é um vetor por notícia, não uma coleção.
 */
const SOURCE_ID = 'microteia:news';
const COMMENT_SOURCE_ID = 'microteia:news-comment';

const READ_TAB_PREFIX = 'news-read:';

const CONTEUDO = 'Conteúdo';

/**
 * Os campos do FORMULÁRIO — os cinco que alguém preenche ao publicar. Ficam de fora, de propósito,
 * `likedBy`, `readBy`, `savedBy` e `viewCount`: são estado de leitura, escritos por um gesto (curtir,
 * abrir, guardar) e nunca digitados. Declará-los os poria no formulário e nos filtros, onde só
 * atrapalhariam — a mesma razão pela qual o corpo do e-mail não é campo na extensão de Pushes.
 */
const FIELDS: TemplateField[] = [
  { key: 'title', label: 'Título', type: 'text', required: true, order: 0, section: CONTEUDO, placeholder: 'Título da notícia...' },
  { key: 'category', label: 'Categoria', type: 'select', required: false, order: 1, section: CONTEUDO, lookupCollection: 'newsCategories', optionsAllowUserAdd: true, filterable: true },
  { key: 'sourceURL', label: 'Link da fonte', type: 'text', required: false, order: 2, section: CONTEUDO, placeholder: 'https://...' },
  { key: 'summary', label: 'Resumo', type: 'textarea', required: true, order: 3, section: CONTEUDO, placeholder: 'Resumo curto exibido na listagem...' },
  { key: 'content', label: 'Conteúdo completo', type: 'markdown', required: false, order: 4, section: CONTEUDO },
];

/**
 * O comentário é uma TELA FILHA, não uma anotação. A anotação nativa não tem edição nem curtida, e as
 * duas são metade do que um comentário é. Como tela, ele ganha de graça o que qualquer registro tem —
 * autoria carimbada, auditoria, exclusão pelo autor — e a extensão só desenha a conversa.
 */
const COMMENT_FIELDS: TemplateField[] = [
  { key: 'newsId', label: 'Notícia', type: 'reference', required: true, order: 0, refEntity: 'news' },
  { key: 'content', label: 'Comentário', type: 'markdown', required: true, order: 1 },
];

const options = (entries: [string, string][]): CustomFieldOption[] =>
  entries.map(([key, label]) => ({ key, label }));

/**
 * As categorias que o kernel trazia em `lookupDefaults`. A CHAVE segue em inglês porque é o que está
 * gravado nas notícias desde a primeira — a lista descreve o banco como ele é.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: 'newsCategories',
    label: 'Notícia: Categoria',
    options: options([
      ['GENERAL', 'Geral'],
      ['ANNOUNCEMENT', 'Comunicado'],
      ['CIRCULAR', 'Circular'],
      ['UPDATE', 'Atualização'],
    ]),
  },
];

const TAG_LISTS: LookupModuleTemplate[] = [
  { collection: 'newsTags', label: 'Notícia: Etiquetas' },
];

const NEWS_SCREEN: ScreenModuleTemplate = {
  key: 'news',
  sourceId: SOURCE_ID,
  titleSingular: 'Notícia',
  titlePlural: 'Notícias',
  icon: 'newspaper',
  dataCollection: 'news',
  fields: FIELDS,
  titleFieldKey: 'title',
  subtitleFieldKey: 'summary',
  hasNotes: false,
  hasDocuments: true,
  hasTags: true,
  tagCollection: 'newsTags',
  eventPrefix: 'news',
  // Quem abre a notícia de FORA — a auditoria, uma menção, o ⌘K — cai na LEITURA, não no formulário.
  recordTabPrefix: READ_TAB_PREFIX,
  listActions: ['copyLink', 'manageTags', 'delete'],
  // Editar o CONTEÚDO segue a permissão padrão do escritório. O que é "por usuário" — marcar como
  // lida, curtir, guardar para depois — é gravação no documento que outra pessoa criou, e por isso
  // sai por outra porta: qualquer membro grava estes quatro campos e nada mais. Sem isso, quem tem o
  // papel `user` (somente leitura) não conseguia sequer marcar uma notícia como lida, e o selo do
  // menu ficava preso para sempre.
  writeRoles: null,
  memberWritableFields: ['readBy', 'savedBy', 'likedBy', 'viewCount'],
  // Quem publicou apaga o que publicou, sem depender de um admin.
  authorCanDelete: true,
  // O item de menu é declarado à parte, para levar o selo.
  hideFromSidebar: true,
  sidebarOrder: 90,
};

const COMMENTS_SCREEN: ScreenModuleTemplate = {
  key: 'newsComments',
  sourceId: COMMENT_SOURCE_ID,
  titleSingular: 'Comentário',
  titlePlural: 'Comentários',
  icon: 'chat3',
  fields: COMMENT_FIELDS,
  titleFieldKey: 'content',
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  parentEntity: 'news',
  parentFieldKey: 'newsId',
  parentRelation: 'owned',
  // A conversa se lê EMBAIXO da notícia, na tela de leitura. Como aba do formulário de edição seria
  // a mesma coisa duas vezes — e no lugar em que ninguém a procura.
  hideFromParentTabs: true,
  listActions: ['delete'],
  // Num mural, comentar é de TODO MUNDO — inclusive de quem só lê o resto do escritório. É o que a
  // regra nomeada de `newsComments` dizia (qualquer autenticado cria o próprio comentário), e aqui a
  // lista declarada ALARGA a permissão padrão em vez de estreitá-la.
  writeRoles: ['admin', 'lawyer', 'secretary', 'user'],
  authorCanDelete: true,
  hideFromSidebar: true,
};

/**
 * A LISTAGEM. Não usa a superfície padrão de cartões: o cartão de uma notícia é uma peça de leitura —
 * autor à esquerda, título, resumo e a linha de convívio embaixo (curtidas, visualizações,
 * comentários) —, e não um resumo de cadastro. O que vem do padrão é a moldura (`EntityListView` em
 * `layout="list"`, porque o cartão quer a largura inteira), os filtros derivados dos campos, os
 * modais e as AÇÕES: o que aparece no cartão continua governado pelo Form Design.
 *
 * O filtro "Status de leitura" é o único que a extensão acrescenta à mão, e tem de ser: ele não olha
 * um campo, olha a relação entre a notícia e quem está lendo a tela.
 */

/**
 * A LEITURA. É a tela que a declaração não alcança: uma notícia não se lê num formulário — se lê como
 * artigo, com o autor ao lado, o conteúdo em Markdown e a conversa embaixo. Editar continua sendo o
 * formulário NATIVO (`list.openRecord`), que o schema descreve inteiro; aqui só mora o que é leitura.
 *
 * Os comentários são registros da tela filha, montados à mão porque a conversa tem forma própria —
 * curtida, edição com marca de "(editado)", recolher e "mais...". Quem grava, exclui e carimba a
 * autoria é o mesmo caminho de qualquer registro; a extensão não conhece repositório nenhum.
 */

/**
 * O STARTUP: a busca do ⌘K e a menção `@notícia` das anotações. As duas apontam para a LEITURA — que é
 * onde uma notícia é aberta —, e não para o formulário.
 */

export const noticiaPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.noticia',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Notícias',
    description: 'O mural do escritório recriado como extensão — com o não-lido por usuário, os comentários e as etiquetas.',
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      nav({
        key: 'news',
        label: 'Notícias',
        icon: 'newspaper',
        order: 90,
        // O selo PESSOAL: as notícias que ESTE usuário ainda não leu, tirando as que ele mesmo
        // publicou. É uma expressão sobre os registros que a listagem já enxerga — não há contador
        // por usuário em coleção nenhuma, e o número desce sozinho quando ele abre a notícia.
        badge: { collection: 'news', when: 'not contains(readBy, user.id) and createdBy != user.id' },
      }),
      page({ key: 'news', title: 'Notícias', icon: 'newspaper' }, 'news'),
      page({ key: '', keyPrefix: READ_TAB_PREFIX, title: 'Notícia', icon: 'newspaper' }, 'news-read'),
    ],
  },
  summary:
    'O mural do escritório: o comunicado que alguém publica, um selo no menu com o que VOCÊ ainda não leu, curtidas, guardar para depois, etiquetas, documentos anexados e a conversa em comentários embaixo de cada notícia.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'A extensão **Notícias** traz o mural do escritório: qualquer pessoa publica um comunicado, com resumo, conteúdo em Markdown, categoria e link para a fonte.\n\nO item no menu mostra **quantas notícias você ainda não leu** — o número é seu, não do escritório, e desce assim que você abre cada uma. A lista abre justamente nelas, e você pode **guardar para depois** o que quiser reler.\n\nCada notícia tem **comentários**, com curtida, edição e "(editado)" à mostra. Quem comenta devolve a notícia à caixa de todos, para que ninguém perca a conversa.\n\nQuem publicou pode **editar e excluir** o que publicou, sem depender de um administrador — e o mesmo vale para cada comentário.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Notícias" no menu, com o seu contador de não lidas' },
          { label: 'Cadastro', value: '5 campos, mais etiquetas e documentos' },
          { label: 'Conversa', value: 'Comentários com curtida e edição' },
          { label: 'Abre em', value: 'Notícias não lidas' },
        ],
      },
      {
        type: 'banner',
        message: 'O lido, o curtido e o guardado ficam gravados na própria notícia, por usuário. Cada pessoa vê o seu.',
        variant: 'info',
      },
      {
        type: 'banner',
        message: 'Remover a extensão remove as telas, nunca as notícias: os registros continuam no escritório e voltam a aparecer se ela for instalada de novo.',
        variant: 'info',
      },
    ],
  },
  workflows: [],
  screens: [NEWS_SCREEN, COMMENTS_SCREEN],
  lookups: LOOKUPS,
  tagLists: TAG_LISTS,
  startup: STARTUP_SOURCE,
  views: [
    { key: 'news', title: 'Notícias', icon: 'newspaper', source: NEWS_LIST_SOURCE },
    { key: 'news-read', title: 'Notícia', icon: 'newspaper', source: NEWS_READ_SOURCE },
  ],
};
