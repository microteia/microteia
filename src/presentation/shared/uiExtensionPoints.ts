import type { ExtensionPointDefinition } from '../../domain/schema/plugin/extensionPoint';
import type { UserRole } from '../../domain/entities';

export const UI_PAGE_POINT = 'ui.page';
export const UI_NAV_POINT = 'ui.nav';
export const UI_COMMAND_POINT = 'ui.command';

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
