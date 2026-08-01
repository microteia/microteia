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

export interface UiNavMetadata {
  key: string;
  label: string;
  icon: string;
  order: number;
  requiresTenantAdmin?: boolean;
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
];
