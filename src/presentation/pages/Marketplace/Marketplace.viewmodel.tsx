import { useCallback, useMemo, useState } from 'react';
import { usePluginStore } from '../../../stores/usePluginStore';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import { useKernel } from '../../../stores/useKernel';
import { useWorkspace } from '../../../stores/useWorkspace';
import type { MarketplacePlugin } from '../../../domain/entities/MarketplacePlugin';

export interface MarketplaceCard {
  plugin: MarketplacePlugin;
  installed: boolean;
  enabled: boolean;
  installedVersion?: string;
  workflowCount: number;
  published: boolean;
  /** Extensão instalada a partir de um `.json`, fora do catálogo. */
  imported: boolean;
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
  openAuthor: () => void;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  install: (plugin: MarketplacePlugin) => Promise<void>;
  uninstall: (pluginId: string) => Promise<void>;
  toggleEnabled: (pluginId: string, enabled: boolean) => Promise<void>;
  publish: (plugin: MarketplacePlugin) => Promise<void>;
  unpublish: (pluginId: string) => Promise<void>;
}

export const useMarketplaceViewModel = (): MarketplaceViewModel => {
  const { catalog, installations, installationOf, sourceOf, canPublish, install, uninstall, setEnabled, importPackage, publish, unpublish } =
    usePluginStore();
  const { host, result } = useKernel();
  const { tenantRole } = useTenant();
  const { userRole } = useAuth();
  const { notify } = useNotification();
  const { openTab } = useWorkspace();
  const [busyPluginId, setBusyPluginId] = useState<string | null>(null);
  const [detailPlugin, setDetailPlugin] = useState<MarketplacePlugin | null>(null);

  const canManage = userRole === 'SYSTEM' || tenantRole === 'admin';

  const openDetail = useCallback((plugin: MarketplacePlugin) => setDetailPlugin(plugin), []);
  const closeDetail = useCallback(() => setDetailPlugin(null), []);
  const openAuthor = useCallback(() => openTab('plugin-author'), [openTab]);

  const loadErrorOf = useCallback(
    (pluginId: string, installed: boolean, enabled: boolean): string | undefined => {
      if (!installed || !enabled || host.isLoaded(pluginId)) return undefined;
      return result.diagnostics.find((d) => d.pluginId === pluginId && d.severity === 'error')?.message;
    },
    [host, result],
  );

  const catalogCards = useMemo<MarketplaceCard[]>(
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
          imported: false,
          loadError: loadErrorOf(plugin.manifest.id, installed, enabled),
        };
      }),
    [catalog, installationOf, sourceOf, loadErrorOf],
  );

  // Extensões importadas de um `.json` instalam-se sem entrar no catálogo. Sem estes cards, elas
  // funcionariam mas não teriam onde ser desativadas/removidas.
  const importedCards = useMemo<MarketplaceCard[]>(
    () =>
      installations
        .filter((installation) => !catalog.some((plugin) => plugin.manifest.id === installation.pluginId))
        .map((installation) => {
          const meta = installation.config ?? {};
          const name = (typeof meta.name === 'string' && meta.name) || installation.pluginId;
          const summary = (typeof meta.summary === 'string' && meta.summary) || 'Extensão importada neste escritório.';
          const workflowCount = typeof meta.workflowCount === 'number' ? meta.workflowCount : 0;
          return {
            plugin: {
              manifest: {
                id: installation.pluginId,
                version: installation.version,
                kernel: '^1.0.0',
                name,
              },
              summary,
              workflows: [],
            },
            installed: true,
            enabled: installation.enabled,
            installedVersion: installation.version,
            workflowCount,
            published: false,
            imported: true,
            loadError: loadErrorOf(installation.pluginId, true, installation.enabled),
          };
        }),
    [installations, catalog, loadErrorOf],
  );

  const cards = useMemo<MarketplaceCard[]>(
    () => [...catalogCards, ...importedCards],
    [catalogCards, importedCards],
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

  const onImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusyPluginId('__import__');
    try {
      const result = await importPackage(await file.text());
      if (result.ok) {
        notify(`${result.name} ${result.action === 'upgraded' ? 'atualizado' : 'instalado'}.`, 'success');
        if (result.note) notify(result.note, 'warning');
      } else notify(`Não foi possível importar: ${result.error}`, 'error');
    } catch (err) {
      notify(`Não foi possível importar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setBusyPluginId(null);
    }
  }, [importPackage, notify]);

  return {
    cards,
    canManage,
    canPublish,
    busyPluginId,
    detailPlugin,
    openDetail,
    closeDetail,
    openAuthor,
    onImportFile,
    install: installPlugin,
    uninstall: uninstallPlugin,
    toggleEnabled,
    publish: publishPlugin,
    unpublish: unpublishPlugin,
  };
};
