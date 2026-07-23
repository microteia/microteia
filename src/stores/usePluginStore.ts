import { createContext, useContext } from 'react';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';
import type { PluginInstallation } from '../domain/entities/PluginInstallation';
import type { PluginLifecycleError } from '../domain/entities/PluginInstallation';

export type PluginSource = 'published' | 'builtin';

export interface PluginStoreValue {
  catalog: MarketplacePlugin[];
  installations: PluginInstallation[];
  isLoading: boolean;
  /** Se a equipe global (SYSTEM) pode publicar/despublicar no registro. */
  canPublish: boolean;
  installationOf: (pluginId: string) => PluginInstallation | undefined;
  sourceOf: (pluginId: string) => PluginSource;
  install: (plugin: MarketplacePlugin) => Promise<PluginLifecycleError | null>;
  uninstall: (pluginId: string) => Promise<PluginLifecycleError | null>;
  setEnabled: (pluginId: string, enabled: boolean) => Promise<PluginLifecycleError | null>;
  publish: (plugin: MarketplacePlugin) => Promise<void>;
  unpublish: (pluginId: string) => Promise<void>;
}

export const PluginStoreContext = createContext<PluginStoreValue | null>(null);

export const usePluginStore = (): PluginStoreValue => {
  const ctx = useContext(PluginStoreContext);
  if (!ctx) throw new Error('usePluginStore must be used within PluginStoreProvider');
  return ctx;
};
