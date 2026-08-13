import type { ExtensionPointDefinition } from '../../domain/schema/plugin/extensionPoint';
import type { UserRole } from '../../domain/entities';

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
  requiredRole?: UserRole;
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
  requiresTenantAdmin?: boolean;
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
  /** A ação exige ser admin do escritório. */
  requiresTenantAdmin?: boolean;
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
 * é o que faz uma extensão recém-instalada já aparecer no Painel sem ninguém configurar nada.
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
  requiredRole?: UserRole;
}

export const UI_WIDGET_POINT = 'ui.widget';
export const UI_SETTINGS_POINT = 'ui.settings';

export const UI_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: UI_PAGE_POINT,
    apiVersion: UI_API_VERSION,
    title: 'Tela do workspace',
    description: 'Registra uma aba abrível no workspace, por chave exata ou por prefixo.',
    ownerPluginId: 'core.ui',
    allowedImplKinds: ['code', 'widget'],
    implRequired: true,
    multiple: true,
  },
  {
    id: UI_NAV_POINT,
    apiVersion: UI_API_VERSION,
    title: 'Item da barra lateral',
    description: 'Adiciona um item ao menu principal, apontando para a chave de uma tela.',
    ownerPluginId: 'core.ui',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
  {
    id: UI_RECORD_ACTION_POINT,
    apiVersion: UI_API_VERSION,
    title: 'Ação de registro',
    description: 'Acrescenta uma ação ao cartão da listagem e ao cabeçalho do registro.',
    ownerPluginId: 'core.ui',
    allowedImplKinds: ['code'],
    implRequired: true,
    multiple: true,
  },
  {
    id: UI_COMMAND_POINT,
    apiVersion: UI_API_VERSION,
    title: 'Provedor do Command Palette',
    description: 'Fornece itens pesquisáveis no ⌘K.',
    ownerPluginId: 'core.ui',
    allowedImplKinds: ['code'],
    implRequired: true,
    multiple: true,
  },
  {
    id: UI_WIDGET_POINT,
    apiVersion: UI_API_VERSION,
    title: 'Widget de superfície',
    description: 'Acrescenta um cartão a uma superfície (o Painel, por exemplo), ligado e ordenado pela configuração.',
    ownerPluginId: 'core.ui',
    allowedImplKinds: ['code', 'widget'],
    implRequired: true,
    multiple: true,
  },
  {
    id: UI_SETTINGS_POINT,
    apiVersion: UI_API_VERSION,
    title: 'Seção de configuração',
    description: 'Declara uma seção da tela de Configurações, com as propriedades que o plugin aceita.',
    ownerPluginId: 'core.ui',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
];
