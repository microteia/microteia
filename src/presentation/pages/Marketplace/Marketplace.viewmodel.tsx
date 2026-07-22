import { useCallback, useMemo, useState } from 'react';
import { usePluginStore } from '../../../stores/usePluginStore';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import type { MarketplacePlugin } from '../../../domain/entities/MarketplacePlugin';

export interface MarketplaceCard {
  plugin: MarketplacePlugin;
  installed: boolean;
  enabled: boolean;
  installedVersion?: string;
  workflowCount: number;
}

export interface MarketplaceViewModel {
  cards: MarketplaceCard[];
  canManage: boolean;
  busyPluginId: string | null;
  install: (plugin: MarketplacePlugin) => Promise<void>;
  uninstall: (pluginId: string) => Promise<void>;
  toggleEnabled: (pluginId: string, enabled: boolean) => Promise<void>;
}

export const useMarketplaceViewModel = (): MarketplaceViewModel => {
  const { catalog, installationOf, install, uninstall, setEnabled } = usePluginStore();
  const { tenantRole } = useTenant();
  const { userRole } = useAuth();
  const { notify } = useNotification();
  const [busyPluginId, setBusyPluginId] = useState<string | null>(null);

  const canManage = userRole === 'SYSTEM' || tenantRole === 'admin';

  const cards = useMemo<MarketplaceCard[]>(
    () =>
      catalog.map((plugin) => {
        const installation = installationOf(plugin.manifest.id);
        return {
          plugin,
          installed: Boolean(installation),
          enabled: installation?.enabled ?? false,
          installedVersion: installation?.version,
          workflowCount: plugin.workflows.length,
        };
      }),
    [catalog, installationOf],
  );

  const run = useCallback(
    async (pluginId: string, action: () => Promise<{ message: string } | null>, successMessage: string) => {
      setBusyPluginId(pluginId);
      try {
        const error = await action();
        if (error) notify(error.message, 'error');
        else notify(successMessage, 'success');
      } catch {
        notify('Não foi possível concluir a operação.', 'error');
      } finally {
        setBusyPluginId(null);
      }
    },
    [notify],
  );

  const installPlugin = useCallback(
    (plugin: MarketplacePlugin) =>
      run(plugin.manifest.id, () => install(plugin), `${plugin.manifest.name} instalado.`),
    [run, install],
  );

  const uninstallPlugin = useCallback(
    (pluginId: string) => run(pluginId, () => uninstall(pluginId), 'Extensão removida.'),
    [run, uninstall],
  );

  const toggleEnabled = useCallback(
    (pluginId: string, enabled: boolean) =>
      run(pluginId, () => setEnabled(pluginId, enabled), enabled ? 'Extensão ativada.' : 'Extensão desativada.'),
    [run, setEnabled],
  );

  return {
    cards,
    canManage,
    busyPluginId,
    install: installPlugin,
    uninstall: uninstallPlugin,
    toggleEnabled,
  };
};
