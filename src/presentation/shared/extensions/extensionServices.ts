import type React from 'react';
import { useSyncExternalStore } from 'react';
import type { ICommandPaletteProvider } from '../../components/ui/CommandPalette/providers/ICommandPaletteProvider';
import type { EntityRecord, ScreenDefinition } from '../../../domain/entities';
import type { SettingsSection } from '../../../domain/schema/settings';
import type { UiWidgetMetadata } from '../../../domain/schema/ui/uiExtensionPoints';

/** Um resultado de menção `@`: vira o link `[title](/microteia/<tabKey>)` no markdown. */
export interface MentionResult {
  id: string;
  title: string;
  subtitle?: string;
  tabKey: string;
}

/** Contexto entregue à busca de menção — os dados que a extensão precisa para achar seus registros. */
export interface MentionSearchContext {
  /** Registros de TODAS as telas do tenant, com os campos na raiz de cada um. */
  records: EntityRecord[];
  screenDefinitions: ScreenDefinition[];
}

/**
 * Um tipo de menção que uma extensão adiciona ao `@` do editor de texto: um rótulo/ícone e uma busca
 * que devolve registros como links de deeplink. `search` é pura (recebe o contexto), então roda no
 * componente do picker sem depender de hooks no código de startup.
 */
export interface ExtensionMentionProvider {
  key: string;
  label: string;
  description?: string;
  /** Chave do conjunto curado de ícones (`screenIcons`). */
  icon?: string;
  search: (query: string, context: MentionSearchContext) => MentionResult[];
}

/**
 * Registro de SERVIÇOS de extensões — o que o `startup` de cada extensão registra no host ao carregar.
 * É um store externo (fora do React) porque o `startup` roda como código puro; os consumidores (ex.:
 * `useCommandProviders`) leem por `useSyncExternalStore` e re-renderizam quando muda. Tudo é escopado
 * por `pluginId`, para que desativar/desinstalar uma extensão remova exatamente os seus serviços.
 */
/**
 * Um widget de superfície entregue em CÓDIGO por uma extensão confiável: a metadata declarativa
 * (a mesma do ponto `ui.widget`, para que os dois caminhos cheguem iguais a quem renderiza) mais o
 * componente já avaliado. O componente não recebe props — ele lê dados pelos hooks da API curada,
 * exatamente como uma tela de extensão.
 */
export interface ExtensionSurfaceWidget extends UiWidgetMetadata {
  component: React.ComponentType;
}

/**
 * Uma seção de Configurações registrada em código. Além das propriedades declarativas, ela pode
 * trazer um EDITOR próprio — a saída para o que caixinha e select não expressam (arrastar widgets,
 * por exemplo). O editor é opcional: sem ele, o hospedeiro desenha as propriedades declaradas.
 */
export interface ExtensionSettingsSection extends SettingsSection {
  editor?: React.ComponentType;
}

const commandProvidersByPlugin = new Map<string, ICommandPaletteProvider[]>();
const mentionProvidersByPlugin = new Map<string, ExtensionMentionProvider[]>();
const surfaceWidgetsByPlugin = new Map<string, ExtensionSurfaceWidget[]>();
const settingsSectionsByPlugin = new Map<string, ExtensionSettingsSection[]>();
const listeners = new Set<() => void>();
let commandSnapshot: ICommandPaletteProvider[] = [];
let mentionSnapshot: ExtensionMentionProvider[] = [];
let surfaceWidgetSnapshot: ExtensionSurfaceWidget[] = [];
let settingsSectionSnapshot: ExtensionSettingsSection[] = [];

const recompute = (): void => {
  commandSnapshot = Array.from(commandProvidersByPlugin.values()).flat();
  mentionSnapshot = Array.from(mentionProvidersByPlugin.values()).flat();
  surfaceWidgetSnapshot = Array.from(surfaceWidgetsByPlugin.values()).flat();
  settingsSectionSnapshot = Array.from(settingsSectionsByPlugin.values()).flat();
};

const emit = (): void => {
  recompute();
  listeners.forEach((listener) => listener());
};

export const registerCommandProvider = (pluginId: string, provider: ICommandPaletteProvider): void => {
  commandProvidersByPlugin.set(pluginId, [...(commandProvidersByPlugin.get(pluginId) ?? []), provider]);
  emit();
};

export const registerMentionProvider = (pluginId: string, provider: ExtensionMentionProvider): void => {
  mentionProvidersByPlugin.set(pluginId, [...(mentionProvidersByPlugin.get(pluginId) ?? []), provider]);
  emit();
};

export const registerSurfaceWidget = (pluginId: string, widget: ExtensionSurfaceWidget): void => {
  surfaceWidgetsByPlugin.set(pluginId, [...(surfaceWidgetsByPlugin.get(pluginId) ?? []), widget]);
  emit();
};

export const registerSettingsSection = (pluginId: string, section: ExtensionSettingsSection): void => {
  settingsSectionsByPlugin.set(pluginId, [...(settingsSectionsByPlugin.get(pluginId) ?? []), section]);
  emit();
};

/** Remove todos os serviços de um plugin — chamado no teardown do startup (desativar/desinstalar). */
export const clearPluginServices = (pluginId: string): void => {
  const removed = [
    commandProvidersByPlugin.delete(pluginId),
    mentionProvidersByPlugin.delete(pluginId),
    surfaceWidgetsByPlugin.delete(pluginId),
    settingsSectionsByPlugin.delete(pluginId),
  ];
  if (removed.some(Boolean)) emit();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

const getCommandSnapshot = (): ICommandPaletteProvider[] => commandSnapshot;
const getMentionSnapshot = (): ExtensionMentionProvider[] => mentionSnapshot;

export const useExtensionCommandProviders = (): ICommandPaletteProvider[] =>
  useSyncExternalStore(subscribe, getCommandSnapshot);

export const useExtensionMentionProviders = (): ExtensionMentionProvider[] =>
  useSyncExternalStore(subscribe, getMentionSnapshot);

const getSurfaceWidgetSnapshot = (): ExtensionSurfaceWidget[] => surfaceWidgetSnapshot;
const getSettingsSectionSnapshot = (): ExtensionSettingsSection[] => settingsSectionSnapshot;

export const useExtensionSurfaceWidgets = (): ExtensionSurfaceWidget[] =>
  useSyncExternalStore(subscribe, getSurfaceWidgetSnapshot);

export const useExtensionSettingsSections = (): ExtensionSettingsSection[] =>
  useSyncExternalStore(subscribe, getSettingsSectionSnapshot);
