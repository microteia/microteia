import { useCallback, useMemo, useState } from 'react';
import { usePluginStore } from '../../../stores/usePluginStore';
import { useTenantExtensions } from '../../../stores/useTenantExtensions';
import { usePublicExtensions } from '../../../stores/usePublicExtensions';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import { useKernel } from '../../../stores/useKernel';
import { useWorkspace } from '../../../stores/useWorkspace';
import { serializePackage } from '../../../domain/usecases/plugins/packageSerialization';
import type { MarketplacePlugin } from '../../../domain/entities/MarketplacePlugin';
import type { PublicExtensionStatus } from '../../../domain/entities/PublicExtension';

export interface MyExtensionCard {
  id: string;
  name: string;
  summary: string;
  version: string;
  active: boolean;
  hasCode: boolean;
  /** Status no catálogo público: null = privada (não publicada). */
  publicStatus: PublicExtensionStatus | null;
  authorName: string | null;
  authorPhotoURL: string | null;
}

export interface PublicCard {
  domain: string;
  name: string;
  summary: string;
  version: string;
  hasCode: boolean;
  status: PublicExtensionStatus;
  authorName: string;
  authorPhotoURL: string | null;
}

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
  myExtensions: MyExtensionCard[];
  publicCards: PublicCard[];
  pendingCards: PublicCard[];
  canManage: boolean;
  canPublish: boolean;
  canModerate: boolean;
  busyPluginId: string | null;
  detailPlugin: MarketplacePlugin | null;
  removeTarget: { id: string; name: string } | null;
  openDetail: (plugin: MarketplacePlugin) => void;
  closeDetail: () => void;
  openAuthor: () => void;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  install: (plugin: MarketplacePlugin) => Promise<void>;
  uninstall: (pluginId: string) => Promise<void>;
  toggleEnabled: (pluginId: string, enabled: boolean) => Promise<void>;
  publish: (plugin: MarketplacePlugin) => Promise<void>;
  unpublish: (pluginId: string) => Promise<void>;
  editMyExtension: (id: string) => void;
  downloadMyExtension: (id: string) => void;
  toggleMyActive: (id: string, active: boolean) => Promise<void>;
  publishMyExtension: (id: string) => Promise<void>;
  requestRemoveMyExtension: (id: string) => void;
  confirmRemoveMyExtension: () => Promise<void>;
  cancelRemoveMyExtension: () => void;
  approvePublic: (domain: string) => Promise<void>;
  deprecatePublic: (domain: string) => Promise<void>;
  rejectPublic: (domain: string) => Promise<void>;
}

export const useMarketplaceViewModel = (): MarketplaceViewModel => {
  const { catalog, installations, installationOf, sourceOf, canPublish, install, uninstall, setEnabled, publish, unpublish } =
    usePluginStore();
  const { extensions, importExtension, setActive: setExtensionActive, removeExtension } = useTenantExtensions();
  const { publicExtensions, publish: publishPublic, approve, deprecate, unpublish: unpublishPublic, publicOf } = usePublicExtensions();
  const { host, result } = useKernel();
  const { tenantRole } = useTenant();
  const { userRole } = useAuth();
  const { notify } = useNotification();
  const { openTab } = useWorkspace();
  const [busyPluginId, setBusyPluginId] = useState<string | null>(null);
  const [detailPlugin, setDetailPlugin] = useState<MarketplacePlugin | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

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

  const myExtensions = useMemo<MyExtensionCard[]>(
    () => extensions.map((extension) => ({
      id: extension.id,
      name: extension.package.manifest.name,
      summary: extension.package.summary,
      version: extension.package.manifest.version,
      active: extension.active,
      hasCode: (extension.package.views?.length ?? 0) > 0,
      publicStatus: publicOf(extension.id)?.status ?? null,
      authorName: extension.createdByName ?? null,
      authorPhotoURL: extension.createdByPhotoURL ?? null,
    })),
    [extensions, publicOf],
  );

  const publicCards = useMemo<PublicCard[]>(
    () => publicExtensions
      .filter((p) => p.status === 'approved')
      .map((p) => ({
        domain: p.domain,
        name: p.package.manifest.name,
        summary: p.package.summary,
        version: p.version,
        hasCode: p.hasCode,
        status: p.status,
        authorName: p.ownerName,
        authorPhotoURL: p.ownerPhotoURL,
      })),
    [publicExtensions],
  );

  const pendingCards = useMemo<PublicCard[]>(
    () => (canPublish
      ? publicExtensions
        .filter((p) => p.status === 'pending')
        .map((p) => ({
          domain: p.domain,
          name: p.package.manifest.name,
          summary: p.package.summary,
          version: p.version,
          hasCode: p.hasCode,
          status: p.status,
          authorName: p.ownerName,
          authorPhotoURL: p.ownerPhotoURL,
        }))
      : []),
    [publicExtensions, canPublish],
  );

  const editMyExtension = useCallback((id: string) => openTab(`plugin-author:${id}`), [openTab]);

  const downloadMyExtension = useCallback((id: string) => {
    const extension = extensions.find((e) => e.id === id);
    if (!extension) return;
    const blob = new Blob([serializePackage(extension.package)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [extensions]);

  const toggleMyActive = useCallback(
    (id: string, active: boolean) =>
      run(id, async () => { await setExtensionActive(id, active); return null; }, active ? 'Extensão ativada.' : 'Extensão desativada.'),
    [run, setExtensionActive],
  );

  const publishMyExtension = useCallback(async (id: string) => {
    const extension = extensions.find((e) => e.id === id);
    if (!extension) return;
    setBusyPluginId(id);
    try {
      const result = await publishPublic(extension.package);
      if (!result.ok) notify(result.error, 'error');
      else if (result.status === 'pending') {
        notify('Enviada para aprovação: uma extensão com código só fica pública depois de aprovada por um administrador do sistema.', 'warning');
      } else notify('Publicada no catálogo.', 'success');
    } catch (err) {
      notify(`Não foi possível publicar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setBusyPluginId(null);
    }
  }, [extensions, publishPublic, notify]);

  const approvePublic = useCallback(
    (domain: string) => run(domain, async () => { await approve(domain); return null; }, 'Extensão aprovada.'),
    [run, approve],
  );
  const deprecatePublic = useCallback(
    (domain: string) => run(domain, async () => { await deprecate(domain); return null; }, 'Extensão marcada como obsoleta.'),
    [run, deprecate],
  );
  const rejectPublic = useCallback(
    (domain: string) => run(domain, async () => { await unpublishPublic(domain); return null; }, 'Publicação recusada e removida do catálogo.'),
    [run, unpublishPublic],
  );

  const requestRemoveMyExtension = useCallback((id: string) => {
    const extension = extensions.find((e) => e.id === id);
    setRemoveTarget({ id, name: extension?.package.manifest.name ?? id });
  }, [extensions]);

  const cancelRemoveMyExtension = useCallback(() => setRemoveTarget(null), []);

  const confirmRemoveMyExtension = useCallback(async () => {
    if (!removeTarget) return;
    const { id } = removeTarget;
    setRemoveTarget(null);
    await run(id, async () => { await removeExtension(id); return null; }, 'Extensão excluída.');
  }, [removeTarget, run, removeExtension]);

  const onImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusyPluginId('__import__');
    try {
      // Importar = criar um RASCUNHO privado em Minhas Extensões (você vira o dono, edita/ativa/publica).
      const result = await importExtension(await file.text());
      if (result.ok) notify(`${result.name} importado para Minhas Extensões.`, 'success');
      else notify(`Não foi possível importar: ${result.error}`, 'error');
    } catch (err) {
      notify(`Não foi possível importar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setBusyPluginId(null);
    }
  }, [importExtension, notify]);

  return {
    cards,
    myExtensions,
    publicCards,
    pendingCards,
    canManage,
    canPublish,
    canModerate: canPublish,
    busyPluginId,
    detailPlugin,
    removeTarget,
    openDetail,
    closeDetail,
    openAuthor,
    onImportFile,
    install: installPlugin,
    uninstall: uninstallPlugin,
    toggleEnabled,
    publish: publishPlugin,
    unpublish: unpublishPlugin,
    editMyExtension,
    downloadMyExtension,
    toggleMyActive,
    publishMyExtension,
    requestRemoveMyExtension,
    confirmRemoveMyExtension,
    cancelRemoveMyExtension,
    approvePublic,
    deprecatePublic,
    rejectPublic,
  };
};
