import { useCallback, useMemo, useState } from 'react';
import { useTenantExtensions } from '../../../stores/useTenantExtensions';
import { useInstalledExtensions, type InstallExtensionInput } from '../../../stores/useInstalledExtensions';
import { usePublicExtensions } from '../../../stores/usePublicExtensions';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import { useWorkspace } from '../../../stores/useWorkspace';
import { serializePackage } from '../../../domain/usecases/plugins/packageSerialization';
import { isVersionGreater } from '../../../domain/usecases/plugins/publicExtension';

export interface Author {
  name: string | null;
  photoURL: string | null;
}

export type StatusBadge = 'published' | 'pending' | 'deprecated' | 'private';
export type InstallBadge = 'active' | 'inactive';
export type InstallAction = 'install' | 'update';

/** Uma extensão consolidada: a mesma identidade (id/domínio) aparece uma única vez, reunindo todos os
 *  seus papéis — autoria privada, cópia instalada no escritório e presença no catálogo público —, com
 *  os selos e as ações que fizerem sentido para o estado atual. */
export interface ExtensionRow {
  id: string;
  name: string;
  summary: string;
  version: string;
  author: Author;
  hasCode: boolean;

  installBadge: InstallBadge | null;
  statusBadge: StatusBadge | null;
  updateAvailable: boolean;

  canEdit: boolean;
  install: InstallAction | null;
  active: boolean;
  canToggleActive: boolean;
  published: boolean;
  canPublish: boolean;
  canDownload: boolean;
  canUninstall: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canDeprecate: boolean;

  mine: boolean;
  installed: boolean;
  isPublic: boolean;
}

export type MarketplaceFilter = 'all' | 'installed' | 'mine' | 'catalog';

export interface MarketplaceViewModel {
  canManage: boolean;
  canModerate: boolean;
  rows: ExtensionRow[];
  filter: MarketplaceFilter;
  setFilter: (filter: MarketplaceFilter) => void;
  counts: Record<MarketplaceFilter, number>;
  busyId: string | null;
  removeTarget: { id: string; name: string } | null;
  openAuthor: () => void;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  edit: (id: string) => void;
  download: (id: string) => void;
  publish: (id: string) => Promise<void>;
  install: (id: string) => Promise<void>;
  toggleActive: (id: string, active: boolean) => Promise<void>;
  uninstall: (id: string) => Promise<void>;
  requestRemove: (id: string) => void;
  confirmRemove: () => Promise<void>;
  cancelRemove: () => void;
  approve: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
  deprecate: (id: string) => Promise<void>;
}

const hasCodeOf = (views: unknown[] | undefined): boolean => (views?.length ?? 0) > 0;

const rankOf = (row: ExtensionRow): number => (row.installed ? 0 : row.mine ? 1 : 2);

export const useMarketplaceViewModel = (): MarketplaceViewModel => {
  const { extensions, importExtension, removeExtension } = useTenantExtensions();
  const { installed, install: installCopy, setActive: setInstalledActive, uninstall: uninstallCopy } = useInstalledExtensions();
  const { publicExtensions, publish: publishPublic, approve: approvePublic, deprecate: deprecatePublic, unpublish, publicOf } = usePublicExtensions();
  const { tenantRole } = useTenant();
  const { user, userRole } = useAuth();
  const { notify } = useNotification();
  const { openTab } = useWorkspace();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [filter, setFilter] = useState<MarketplaceFilter>('all');

  const canModerate = userRole === 'SYSTEM';
  const canManage = canModerate || tenantRole === 'admin';

  const openAuthor = useCallback(() => openTab('plugin-author'), [openTab]);

  const run = useCallback(
    async (id: string, action: () => Promise<void>, successMessage: string) => {
      setBusyId(id);
      try {
        await action();
        notify(successMessage, 'success');
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error('[marketplace] falha na operação de extensão:', err);
        notify(`Não foi possível concluir a operação: ${detail}`, 'error');
      } finally {
        setBusyId(null);
      }
    },
    [notify],
  );

  const privateInputOf = useCallback((id: string): InstallExtensionInput | null => {
    const priv = extensions.find((e) => e.id === id);
    if (!priv) return null;
    return {
      package: priv.package,
      source: 'private',
      version: priv.package.manifest.version,
      authorId: priv.createdBy,
      authorName: priv.createdByName ?? user?.displayName ?? '',
      authorPhotoURL: priv.createdByPhotoURL ?? null,
    };
  }, [extensions, user]);

  const publicInputOf = useCallback((domain: string): InstallExtensionInput | null => {
    const pub = publicOf(domain);
    if (!pub) return null;
    return {
      package: pub.package,
      source: 'public',
      version: pub.version,
      authorId: pub.publishedBy,
      authorName: pub.ownerName,
      authorPhotoURL: pub.ownerPhotoURL,
    };
  }, [publicOf]);

  // Fonte mais recente para atualizar uma cópia instalada: a privada do próprio autor se for a mais
  // recente, senão a pública aprovada. Retorna a entrada a copiar quando a versão supera a instalada.
  const updateSourceOf = useCallback((id: string, installedVersion: string): InstallExtensionInput | null => {
    const priv = privateInputOf(id);
    const pub = publicOf(id)?.status === 'approved' ? publicInputOf(id) : null;
    const candidates = [priv, pub].filter((c): c is InstallExtensionInput => c !== null);
    if (candidates.length === 0) return null;
    const best = candidates.reduce((a, b) => (isVersionGreater(b.version, a.version) ? b : a));
    return isVersionGreater(best.version, installedVersion) ? best : null;
  }, [privateInputOf, publicInputOf, publicOf]);

  const rows = useMemo<ExtensionRow[]>(() => {
    const ids = new Set<string>();
    extensions.forEach((e) => ids.add(e.id));
    installed.forEach((i) => ids.add(i.id));
    publicExtensions.forEach((p) => { if (p.status === 'approved' || canModerate) ids.add(p.domain); });

    const list: ExtensionRow[] = [];
    for (const id of ids) {
      const priv = extensions.find((e) => e.id === id);
      const inst = installed.find((i) => i.id === id);
      const pub = publicOf(id);

      const mine = Boolean(priv);
      const installed_ = Boolean(inst);
      const publicStatus = pub?.status ?? null;
      const isApproved = publicStatus === 'approved';

      const pkg = inst?.package ?? priv?.package ?? pub?.package;
      if (!pkg) continue;

      const author: Author = inst
        ? { name: inst.authorName || null, photoURL: inst.authorPhotoURL }
        : priv
          ? { name: priv.createdByName ?? null, photoURL: priv.createdByPhotoURL ?? null }
          : { name: pub?.ownerName || null, photoURL: pub?.ownerPhotoURL ?? null };

      const updateAvailable = inst ? updateSourceOf(id, inst.installedVersion) !== null : false;
      const install: InstallAction | null = inst
        ? (updateAvailable ? 'update' : null)
        : (mine || isApproved ? 'install' : null);

      const statusBadge: StatusBadge | null = publicStatus === 'approved' ? 'published'
        : publicStatus === 'pending' ? 'pending'
          : publicStatus === 'deprecated' ? 'deprecated'
            : mine ? 'private' : null;

      list.push({
        id,
        name: pkg.manifest.name,
        summary: pkg.summary,
        version: inst?.installedVersion ?? priv?.package.manifest.version ?? pub?.version ?? '',
        author,
        hasCode: hasCodeOf(pkg.views),
        installBadge: inst ? (inst.active ? 'active' : 'inactive') : null,
        statusBadge,
        updateAvailable,
        canEdit: mine,
        install,
        active: inst?.active ?? false,
        canToggleActive: installed_,
        published: publicStatus !== null,
        canPublish: mine,
        canDownload: mine || Boolean(inst && inst.authorId === user?.id),
        canUninstall: installed_,
        canDelete: mine,
        canApprove: canModerate && publicStatus === 'pending',
        canDeprecate: canModerate && publicStatus === 'approved',
        mine,
        installed: installed_,
        isPublic: isApproved,
      });
    }

    return list.sort((a, b) => rankOf(a) - rankOf(b) || a.name.localeCompare(b.name));
  }, [extensions, installed, publicExtensions, publicOf, updateSourceOf, canModerate, user]);

  const counts = useMemo<Record<MarketplaceFilter, number>>(() => ({
    all: rows.length,
    installed: rows.filter((r) => r.installed).length,
    mine: rows.filter((r) => r.mine).length,
    catalog: rows.filter((r) => r.isPublic).length,
  }), [rows]);

  const visibleRows = useMemo<ExtensionRow[]>(() => {
    switch (filter) {
      case 'installed': return rows.filter((r) => r.installed);
      case 'mine': return rows.filter((r) => r.mine);
      case 'catalog': return rows.filter((r) => r.isPublic);
      default: return rows;
    }
  }, [rows, filter]);

  const edit = useCallback((id: string) => openTab(`plugin-author:${id}`), [openTab]);

  const downloadPackage = useCallback((id: string, packageJson: string) => {
    const blob = new Blob([packageJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const download = useCallback((id: string) => {
    const priv = extensions.find((e) => e.id === id);
    if (priv) { downloadPackage(id, serializePackage(priv.package)); return; }
    const inst = installed.find((e) => e.id === id);
    if (inst) downloadPackage(id, serializePackage(inst.package));
  }, [extensions, installed, downloadPackage]);

  const publish = useCallback(async (id: string) => {
    const ext = extensions.find((e) => e.id === id);
    if (!ext) return;
    setBusyId(id);
    try {
      const result = await publishPublic(ext.package);
      if (!result.ok) notify(result.error, 'error');
      else if (result.status === 'pending') {
        notify('Enviada para aprovação: uma extensão com código só fica pública depois de aprovada por um administrador do sistema.', 'warning');
      } else notify('Publicada no catálogo.', 'success');
    } catch (err) {
      notify(`Não foi possível publicar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setBusyId(null);
    }
  }, [extensions, publishPublic, notify]);

  const install = useCallback((id: string) => {
    const inst = installed.find((e) => e.id === id);
    if (inst) {
      const input = updateSourceOf(id, inst.installedVersion);
      if (!input) return Promise.resolve();
      return run(id, () => installCopy(input), 'Extensão atualizada.');
    }
    const input = privateInputOf(id) ?? publicInputOf(id);
    if (!input) return Promise.resolve();
    return run(id, () => installCopy(input), 'Instalada no escritório.');
  }, [installed, updateSourceOf, privateInputOf, publicInputOf, run, installCopy]);

  const toggleActive = useCallback(
    (id: string, active: boolean) => run(id, () => setInstalledActive(id, active), active ? 'Extensão ativada.' : 'Extensão desativada.'),
    [run, setInstalledActive],
  );

  const uninstall = useCallback(
    (id: string) => run(id, () => uninstallCopy(id), 'Extensão desinstalada.'),
    [run, uninstallCopy],
  );

  const approve = useCallback((id: string) => run(id, () => approvePublic(id), 'Extensão aprovada.'), [run, approvePublic]);
  const deprecate = useCallback((id: string) => run(id, () => deprecatePublic(id), 'Extensão marcada como obsoleta.'), [run, deprecatePublic]);
  const reject = useCallback((id: string) => run(id, () => unpublish(id), 'Publicação recusada e removida do catálogo.'), [run, unpublish]);

  const requestRemove = useCallback((id: string) => {
    const ext = extensions.find((e) => e.id === id);
    setRemoveTarget({ id, name: ext?.package.manifest.name ?? id });
  }, [extensions]);

  const cancelRemove = useCallback(() => setRemoveTarget(null), []);

  const confirmRemove = useCallback(async () => {
    if (!removeTarget) return;
    const { id } = removeTarget;
    setRemoveTarget(null);
    await run(id, () => removeExtension(id), 'Extensão excluída da sua área privada.');
  }, [removeTarget, run, removeExtension]);

  const onImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusyId('__import__');
    try {
      const result = await importExtension(await file.text());
      if (result.ok) notify(`${result.name} importado para Minhas Extensões.`, 'success');
      else notify(`Não foi possível importar: ${result.error}`, 'error');
    } catch (err) {
      notify(`Não foi possível importar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setBusyId(null);
    }
  }, [importExtension, notify]);

  return {
    canManage,
    canModerate,
    rows: visibleRows,
    filter,
    setFilter,
    counts,
    busyId,
    removeTarget,
    openAuthor,
    onImportFile,
    edit,
    download,
    publish,
    install,
    toggleActive,
    uninstall,
    requestRemove,
    confirmRemove,
    cancelRemove,
    approve,
    reject,
    deprecate,
  };
};
