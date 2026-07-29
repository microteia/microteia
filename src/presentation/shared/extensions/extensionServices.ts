import { useSyncExternalStore } from 'react';
import type { ICommandPaletteProvider } from '../../components/ui/CommandPalette/providers/ICommandPaletteProvider';
import type { EntityRecord, ScreenDefinition } from '../../../domain/entities';

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
const commandProvidersByPlugin = new Map<string, ICommandPaletteProvider[]>();
const mentionProvidersByPlugin = new Map<string, ExtensionMentionProvider[]>();
const listeners = new Set<() => void>();
let commandSnapshot: ICommandPaletteProvider[] = [];
let mentionSnapshot: ExtensionMentionProvider[] = [];

const recompute = (): void => {
  commandSnapshot = Array.from(commandProvidersByPlugin.values()).flat();
  mentionSnapshot = Array.from(mentionProvidersByPlugin.values()).flat();
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

/** Remove todos os serviços de um plugin — chamado no teardown do startup (desativar/desinstalar). */
export const clearPluginServices = (pluginId: string): void => {
  const hadCommands = commandProvidersByPlugin.delete(pluginId);
  const hadMentions = mentionProvidersByPlugin.delete(pluginId);
  if (hadCommands || hadMentions) emit();
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
