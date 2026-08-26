import type { ExtensionPointDefinition } from '../plugin/extensionPoint';

export const UI_PAGE_POINT = 'ui.page';
export const UI_NAV_POINT = 'ui.nav';
export const UI_COMMAND_POINT = 'ui.command';
export const UI_RECORD_ACTION_POINT = 'ui.record.action';

export const UI_API_VERSION = '1.0.0';

/**
 * Posição das telas dinâmicas do escritório no menu: entre os cadastros contribuídos pelos
 * módulos (10..90) e a administração (110+), preservando o lugar que ocupavam antes.
 */
export const DYNAMIC_SCREEN_NAV_ORDER = 100;

/**
 * Uma aba do workspace. `key` casa exatamente; `keyPrefix` casa por prefixo (abas paramétricas
 * como `view-person:123`). O `icon` é uma chave do conjunto curado de `screenIcons` — nunca um
 * componente, para que a metadata continue serializável e viaje até o Marketplace.
 */
export interface UiPageMetadata {
  key: string;
  keyPrefix?: string;
  title: string;
  icon: string;
  fullBleed?: boolean;
/**
 * As PERMISSÕES exigidas para esta contribuição aparecer. Ausente = aparece para todo membro.
 *
 * É uma lista, e basta UMA delas — a mesma pergunta que `canAny` faz. Aqui moravam `requiredRole`
 * (papel global) e `requiresTenantAdmin` (booleano), e as duas obrigavam quem contribui a conhecer
 * os papéis que o produto impunha: uma extensão que quisesse aparecer só para quem cuida do
 * financeiro só tinha "é admin?" para dizer.
 */
  requiredPermissions?: string[];
  /**
   * A tela é do ADMINISTRADOR GLOBAL (`SYSTEM`), não do escritório.
   *
   * É um booleano, e não uma permissão, porque `SYSTEM` não é um perfil: ele existe acima de
   * qualquer escritório — administra todos, e é atribuído antes de o primeiro existir. Uma permissão
   * de escritório não teria onde ser concedida para a tela que gerencia os escritórios.
   */
  requiresSystemAdmin?: boolean;
}

/**
 * O CONTADOR de um item de menu — o selo que diz "há dez coisas te esperando aqui" antes de a tela
 * ser aberta. Declarativo por inteiro: uma contagem de registros de uma coleção, restrita por uma
 * expressão booleana avaliada sobre cada registro.
 *
 * É contagem de REGISTROS, e não de qualquer número que a extensão queira exibir. Isso é limite de
 * propósito: o selo precisa ser calculável sem rodar código da extensão, para valer também para
 * quem não tem código nenhum, e precisa se atualizar sozinho quando os dados mudam — o que só a
 * assinatura da coleção garante.
 */
export interface UiNavBadge {
  /** Coleção contada. Sem tela que a descreva, o selo simplesmente não aparece. */
  collection: string;
  /** Expressão booleana sobre cada registro (campos na raiz). Ausente, conta todos. */
  when?: string;
}

export interface UiNavMetadata {
  key: string;
  label: string;
  icon: string;
  order: number;
  /** Ver `UiPageMetadata.requiredPermissions`. */
  requiredPermissions?: string[];
  badge?: UiNavBadge;
}

export interface UiCommandMetadata {
  group: string;
}

/**
 * Uma ação sobre um REGISTRO — o que o cartão da listagem e o cabeçalho do detalhe oferecem ao lado
 * dos dados: copiar link, duplicar, etiquetas, excluir, desvincular.
 *
 * Existe porque essas quatro eram as ÚNICAS ações que o kernel sabia desenhar, escritas em código e
 * ligadas/desligadas por caixa de seleção. Como contribuição, elas passam a ser dado: uma extensão
 * acrescenta a sua, reordena, troca o rótulo — e as embutidas deixam de ser um caso especial.
 *
 * `key` é o nome pelo qual uma tela a habilita (`listActions`). `slot` é o PAPEL que ela ocupa
 * quando mais de um comando disputa o mesmo lugar: `unlink` e `delete` dividem o slot destrutivo, e
 * é o `hiddenWhen` de cada um que decide qual aparece. Ausente, o slot é a própria chave.
 */
export interface UiRecordActionMetadata {
  key: string;
  slot?: string;
  title: string;
  /** Chave do catálogo curado de `screenIcons` — nunca um componente, para a metadata viajar. */
  icon: string;
  danger?: boolean;
  order: number;
  /** Expressão avaliada com o escopo das Actions (`surface`, `relation`, `role`, campos do registro). */
  hiddenWhen?: string;
  /** Ver `UiPageMetadata.requiredPermissions`. */
  requiredPermissions?: string[];
  /**
   * A ação exige a permissão daquela AÇÃO sobre a coleção do registro — `medico.delete` para
   * excluir, `medico.update` para editar. Não é uma permissão fixa porque a coleção só se conhece em
   * runtime: a mesma ação "Excluir" aparece em toda tela, e cada tela é uma coleção diferente.
   */
  requiresRecordPermission?: 'read' | 'create' | 'update' | 'delete';
  /** A ação só faz sentido quando a tela tem etiquetas. */
  requiresTags?: boolean;
}

/**
 * Um WIDGET de uma superfície — um cartão que uma extensão coloca numa tela que ela não escreveu.
 * A superfície é um nome (`dashboard`), não uma tela específica: quem a hospeda declara o nome, e
 * quem contribui não precisa conhecer nada além dele.
 *
 * O widget declara o PADRÃO (vem ligado? que largura?); quem manda de fato é a configuração
 * `<superfície>.widgets`, editada pelo escritório e pelo usuário. Sem valor gravado, o padrão vale —
 * é o que faz uma extensão recém-instalada já aparecer no Dashboard sem ninguém configurar nada.
 */
export interface UiWidgetMetadata {
  surface: string;
  key: string;
  title: string;
  description?: string;
  /** Chave do conjunto curado de `screenIcons` — nunca um componente. */
  icon?: string;
  defaultEnabled?: boolean;
  /** Largura em colunas da grade da superfície (1 a 3). */
  defaultSpan?: number;
  order?: number;
  /** Ver `UiPageMetadata.requiredPermissions`. */
  requiredPermissions?: string[];
}

/**
 * Uma ABA de uma superfície — a faixa de abas de uma tela que quem contribui não escreveu. Mesma
 * ideia do widget, com uma diferença que muda tudo: numa grade todos aparecem juntos, aqui só um
 * aparece por vez, e a escolha é do usuário.
 *
 * A superfície é um NOME (`tenant-settings`), não uma tela: quem a hospeda declara o nome, e quem
 * contribui não precisa conhecer nada além dele. É o que permite uma extensão acrescentar a própria
 * aba às Configurações do Escritório sem que a tela saiba que ela existe.
 *
 * `tabKey` é o sufixo pelo qual a aba é endereçável de fora — um deep link, o ⌘K, um botão de outra
 * tela. Ausente, vale a própria `key`.
 */
export interface UiTabMetadata {
  surface: string;
  key: string;
  title: string;
  description?: string;
  /** Chave do conjunto curado de `screenIcons` — nunca um componente. */
  icon?: string;
  defaultEnabled?: boolean;
  order?: number;
  /** Ver `UiPageMetadata.requiredPermissions`. */
  requiredPermissions?: string[];
}

/**
 * Um TRECHO de conteúdo numa região nomeada do shell — o que entra no alto da tela, no rodapé, ao
 * lado do logotipo. Mesma ideia do widget e da aba, com uma diferença que muda o desenho: aqui não
 * há grade nem faixa, há uma FILA horizontal de trechos pequenos, e por isso não há largura.
 *
 * A superfície é um NOME (`top-bar.right`), não um componente: quem a hospeda declara o nome, e quem
 * contribui não precisa conhecer nada além dele. É o que permite uma instalação pôr a própria marca,
 * o próprio aviso ou o próprio atalho no shell sem que o shell saiba que eles existem.
 *
 * O `title` não aparece na tela — ele NOMEIA o trecho na configuração que o liga, desliga e ordena.
 * Sem ele, o escritório veria uma lista de chaves ao decidir o que mostrar no alto da própria tela.
 */
export interface UiSlotMetadata {
  surface: string;
  key: string;
  title: string;
  description?: string;
  /** Chave do conjunto curado de `screenIcons` — nunca um componente. */
  icon?: string;
  defaultEnabled?: boolean;
  order?: number;
  /** Ver `UiPageMetadata.requiredPermissions`. */
  requiredPermissions?: string[];
}

/**
 * O que um item de menu FAZ quando alguém o escolhe. É uma união fechada, e é fechada de propósito:
 * um item de menu que pudesse executar qualquer coisa exigiria código, e código é privilégio de
 * primeira parte — o menu deixaria de estar ao alcance de quem só declara.
 *
 * `openTab` abre uma tela do workspace pela chave dela; `url` abre um endereço, que é o que uma
 * instalação precisa para ligar o próprio intranet, o próprio suporte, o próprio manual.
 */
export type UiMenuAction =
  | { kind: 'openTab'; tabKey: string }
  | { kind: 'url'; href: string; newTab?: boolean };

/**
 * Um ITEM de um menu — a linha que se escolhe no menu do usuário, e amanhã em qualquer outro menu
 * que o shell hospede.
 *
 * Existe porque o menu do usuário era oito linhas escritas à mão no shell, cada uma com a permissão
 * dela e a CHAVE DE PÁGINA DE OUTRO PLUGIN embutida: o kernel sabia que existiam `screen-builder`,
 * `data-processor` e `marketplace`, e desinstalar qualquer um deles deixaria a linha lá, abrindo uma
 * aba que ninguém sabe renderizar. Como contribuição, cada item vive no plugin que é dono da tela —
 * e some junto com ele.
 *
 * `group` separa os itens por divisor. Ausente, o item entra no grupo padrão.
 */
export interface UiMenuItemMetadata {
  surface: string;
  key: string;
  title: string;
  /** Chave do conjunto curado de `screenIcons` — nunca um componente. */
  icon?: string;
  group?: string;
  order?: number;
  /** O item é destrutivo — sair, revogar, apagar. Muda só a cor. */
  danger?: boolean;
  defaultEnabled?: boolean;
  /** Ver `UiPageMetadata.requiredPermissions`. */
  requiredPermissions?: string[];
  /** Ver `UiPageMetadata.requiresSystemAdmin`. */
  requiresSystemAdmin?: boolean;
  action: UiMenuAction;
}

/**
 * As regiões do shell que hospedam trechos, pelo nome. Ficam em constante — e não soltas em cada
 * componente — porque são CONTRATO: é por este nome que uma extensão alcança o alto da tela, e um
 * nome digitado errado nos dois lados não falha em lugar nenhum, simplesmente não aparece.
 */
export const WORKSPACE_SLOT_SURFACES = {
  sidebarHeader: 'sidebar.header',
  sidebarFooter: 'sidebar.footer',
  topBarLeft: 'top-bar.left',
  topBarRight: 'top-bar.right',
  statusBarLeft: 'status-bar.left',
  statusBarRight: 'status-bar.right',
} as const;

/**
 * As regiões da TELA DE ENTRADA. Estão separadas das do workspace porque vivem sob outra regra: ali
 * não há escritório, não há configuração e não há permissão — o que aparece é o que foi declarado, e
 * um trecho não pode depender de nada que só exista depois de alguém entrar.
 */
export const LOGIN_SLOT_SURFACES = {
  header: 'login.header',
  footer: 'login.footer',
} as const;

/** O menu que se abre no rodapé da barra lateral, sob o nome de quem está conectado. */
export const USER_MENU_SURFACE = 'user-menu';

export const UI_SLOT_POINT = 'ui.slot';
export const UI_MENU_POINT = 'ui.menu';

export const UI_WIDGET_POINT = 'ui.widget';
export const UI_SETTINGS_POINT = 'ui.settings';
export const UI_TAB_POINT = 'ui.tab';

export const UI_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: UI_PAGE_POINT,
    apiVersion: UI_API_VERSION,
    title: '@core.ui/point.page',
    description: '@core.ui/point.page.description',
    ownerPluginId: 'core.ui',
    allowedImplKinds: ['code', 'widget'],
    implRequired: true,
    multiple: true,
  },
  {
    id: UI_NAV_POINT,
    apiVersion: UI_API_VERSION,
    title: '@core.ui/point.nav',
    description: '@core.ui/point.nav.description',
    ownerPluginId: 'core.ui',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
  {
    id: UI_RECORD_ACTION_POINT,
    apiVersion: UI_API_VERSION,
    title: '@core.ui/point.record-action',
    description: '@core.ui/point.record-action.description',
    ownerPluginId: 'core.ui',
    allowedImplKinds: ['code'],
    implRequired: true,
    multiple: true,
  },
  {
    id: UI_COMMAND_POINT,
    apiVersion: UI_API_VERSION,
    title: '@core.ui/point.command',
    description: '@core.ui/point.command.description',
    ownerPluginId: 'core.ui',
    allowedImplKinds: ['code'],
    implRequired: true,
    multiple: true,
  },
  {
    id: UI_WIDGET_POINT,
    apiVersion: UI_API_VERSION,
    title: '@core.ui/point.widget',
    description: '@core.ui/point.widget.description',
    ownerPluginId: 'core.ui',
    allowedImplKinds: ['code', 'widget'],
    implRequired: true,
    multiple: true,
  },
  {
    id: UI_SETTINGS_POINT,
    apiVersion: UI_API_VERSION,
    title: '@core.ui/point.settings',
    description: '@core.ui/point.settings.description',
    ownerPluginId: 'core.ui',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
  {
    id: UI_TAB_POINT,
    apiVersion: UI_API_VERSION,
    title: '@core.ui/point.tab',
    description: '@core.ui/point.tab.description',
    ownerPluginId: 'core.ui',
    allowedImplKinds: ['code', 'widget'],
    implRequired: true,
    multiple: true,
  },
  {
    id: UI_SLOT_POINT,
    apiVersion: UI_API_VERSION,
    title: '@core.ui/point.slot',
    description: '@core.ui/point.slot.description',
    ownerPluginId: 'core.ui',
    allowedImplKinds: ['code', 'widget'],
    implRequired: true,
    multiple: true,
  },
  {
    id: UI_MENU_POINT,
    apiVersion: UI_API_VERSION,
    title: '@core.ui/point.menu',
    description: '@core.ui/point.menu.description',
    ownerPluginId: 'core.ui',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
];
