import { useSyncExternalStore } from 'react';
import type { ICommandPaletteProvider } from '../../components/ui/CommandPalette/providers/ICommandPaletteProvider';

/**
 * Registro de SERVIÇOS de extensões — o que o `startup` de cada extensão registra no host ao carregar.
 * É um store externo (fora do React) porque o `startup` roda como código puro; os consumidores (ex.:
 * `useCommandProviders`) leem por `useSyncExternalStore` e re-renderizam quando muda. Tudo é escopado
 * por `pluginId`, para que desativar/desinstalar uma extensão remova exatamente os seus serviços.
 */
const commandProvidersByPlugin = new Map<string, ICommandPaletteProvider[]>();
const listeners = new Set<() => void>();
let commandSnapshot: ICommandPaletteProvider[] = [];

const recompute = (): void => {
  commandSnapshot = Array.from(commandProvidersByPlugin.values()).flat();
};

const emit = (): void => {
  recompute();
  listeners.forEach((listener) => listener());
};

export const registerCommandProvider = (pluginId: string, provider: ICommandPaletteProvider): void => {
  commandProvidersByPlugin.set(pluginId, [...(commandProvidersByPlugin.get(pluginId) ?? []), provider]);
  emit();
};

/** Remove todos os serviços de um plugin — chamado no teardown do startup (desativar/desinstalar). */
export const clearPluginServices = (pluginId: string): void => {
  if (commandProvidersByPlugin.delete(pluginId)) emit();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

const getCommandSnapshot = (): ICommandPaletteProvider[] => commandSnapshot;

export const useExtensionCommandProviders = (): ICommandPaletteProvider[] =>
  useSyncExternalStore(subscribe, getCommandSnapshot);
