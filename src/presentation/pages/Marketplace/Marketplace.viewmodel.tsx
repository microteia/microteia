import { useCallback, useMemo, useState } from 'react';
import { usePluginStore } from '../../../stores/usePluginStore';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import { useKernel } from '../../../stores/useKernel';
import type { MarketplacePlugin } from '../../../domain/entities/MarketplacePlugin';

export interface MarketplaceCard {
  plugin: MarketplacePlugin;
  installed: boolean;
  enabled: boolean;
  installedVersion?: string;
  workflowCount: number;
  published: boolean;
  /** Preenchido quando o plugin está instalado e habilitado mas NÃO carregou no escritório. */
  loadError?: string;
}

export interface MarketplaceViewModel {
  cards: MarketplaceCard[];
  canManage: boolean;
  canPublish: boolean;
  busyPluginId: string | null;
  detailPlugin: MarketplacePlugin | null;
  openDetail: (plugin: MarketplacePlugin) => void;
  closeDetail: () => void;
  install: (plugin: MarketplacePlugin) => Promise<void>;
  uninstall: (pluginId: string) => Promise<void>;
  toggleEnabled: (pluginId: string, enabled: boolean) => Promise<void>;
  publish: (plugin: MarketplacePlugin) => Promise<void>;
  unpublish: (pluginId: string) => Promise<void>;
}

export const useMarketplaceViewModel = (): MarketplaceViewModel => {
  const { catalog, installationOf, sourceOf, canPublish, install, uninstall, setEnabled, publish, unpublish } =
    usePluginStore();
  const { host, result } = useKernel();
  const { tenantRole } = useTenant();
  const { userRole } = useAuth();
  const { notify } = useNotification();
  const [busyPluginId, setBusyPluginId] = useState<string | null>(null);
  const [detailPlugin, setDetailPlugin] = useState<MarketplacePlugin | null>(null);

  const canManage = userRole === 'SYSTEM' || tenantRole === 'admin';

  const openDetail = useCallback((plugin: MarketplacePlugin) => setDetailPlugin(plugin), []);
  const closeDetail = useCallback(() => setDetailPlugin(null), []);

  const loadErrorOf = useCallback(
    (pluginId: string, installed: boolean, enabled: boolean): string | undefined => {
      if (!installed || !enabled || host.isLoaded(pluginId)) return undefined;
      return result.diagnostics.find((d) => d.pluginId === pluginId && d.severity === 'error')?.message;
    },
    [host, result],
  );

  const cards = useMemo<MarketplaceCard[]>(
    () =>
      catalog.map((plugin) => {
        const installation = installationOf(plugin.manifest.id);
        const installed = Boolean(installation);
        const enabled = installation?.enabled ?? false;
        return {
          plugin,
          installed,
          enabled,
          installedVersion: installation?.version,
          workflowCount: plugin.workflows.length,
          published: sourceOf(plugin.manifest.id) === 'published',
          loadError: loadErrorOf(plugin.manifest.id, installed, enabled),
        };
      }),
    [catalog, installationOf, sourceOf, loadErrorOf],
  );

  const run = useCallback(
    async (pluginId: string, action: () => Promise<{ message: string } | null>, successMessage: string) => {
      setBusyPluginId(pluginId);
      try {
        const error = await action();
        if (error) notify(error.message, 'error');
        else notify(successMessage, 'success');
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error('[marketplace] falha na operação de extensão:', err);
        notify(`Não foi possível concluir a operação: ${detail}`, 'error');
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

  const publishPlugin = useCallback(
    (plugin: MarketplacePlugin) =>
      run(
        plugin.manifest.id,
        async () => {
          const errors = await publish(plugin);
          return errors.length > 0
            ? { message: `Não foi possível publicar: ${errors[0].message}` }
            : null;
        },
        `${plugin.manifest.name} publicado no catálogo.`,
      ),
    [run, publish],
  );

  const unpublishPlugin = useCallback(
    (pluginId: string) =>
      run(
        pluginId,
        async () => {
          await unpublish(pluginId);
          return null;
        },
        'Publicação removida do catálogo.',
      ),
    [run, unpublish],
  );

  return {
    cards,
    canManage,
    canPublish,
    busyPluginId,
    detailPlugin,
    openDetail,
    closeDetail,
    install: installPlugin,
    uninstall: uninstallPlugin,
    toggleEnabled,
    publish: publishPlugin,
    unpublish: unpublishPlugin,
  };
};
