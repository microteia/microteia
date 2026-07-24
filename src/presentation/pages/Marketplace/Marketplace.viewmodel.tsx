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
import type { PublicExtensionStatus } from '../../../domain/entities/PublicExtension';

export interface Author {
  name: string | null;
  photoURL: string | null;
}

export interface PrivateCard {
  id: string;
  name: string;
  summary: string;
  version: string;
  hasCode: boolean;
  /** Status no catálogo público: null = ainda não publicada. */
  publicStatus: PublicExtensionStatus | null;
  /** Já existe uma cópia instalada deste identificador no escritório? */
  installed: boolean;
  /** Instalada de versão anterior à privada atual → dá para reinstalar/atualizar. */
  installOutdated: boolean;
  author: Author;
}

export interface InstalledCard {
  id: string;
  name: string;
  summary: string;
  version: string;
  active: boolean;
  hasCode: boolean;
  sourceLabel: string;
  updateAvailable: boolean;
  updateVersion: string | null;
  deprecated: boolean;
  isAuthor: boolean;
  author: Author;
}

export interface PublicCard {
  domain: string;
  name: string;
  summary: string;
  version: string;
  hasCode: boolean;
  isAuthor: boolean;
  /** none = não instalada; installed = instalada e atual; update = instalada de versão anterior. */
  installState: 'none' | 'installed' | 'update';
  author: Author;
}

export interface ModerationCard {
  domain: string;
  name: string;
  summary: string;
  version: string;
  author: Author;
}

export interface MarketplaceViewModel {
  canManage: boolean;
  canModerate: boolean;
  privateCards: PrivateCard[];
  installedCards: InstalledCard[];
  publicCards: PublicCard[];
  moderationCards: ModerationCard[];
  busyId: string | null;
  removeTarget: { id: string; name: string } | null;
  openAuthor: () => void;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  editPrivate: (id: string) => void;
  downloadPrivate: (id: string) => void;
  publishPrivate: (id: string) => Promise<void>;
  installPrivate: (id: string) => Promise<void>;
  requestRemovePrivate: (id: string) => void;
  confirmRemovePrivate: () => Promise<void>;
  cancelRemovePrivate: () => void;
  installPublic: (domain: string) => Promise<void>;
  toggleInstalledActive: (id: string, active: boolean) => Promise<void>;
  updateInstalled: (id: string) => Promise<void>;
  uninstallInstalled: (id: string) => Promise<void>;
  downloadInstalled: (id: string) => void;
  approvePublic: (domain: string) => Promise<void>;
  deprecatePublic: (domain: string) => Promise<void>;
  rejectPublic: (domain: string) => Promise<void>;
}

const hasCodeOf = (views: unknown[] | undefined): boolean => (views?.length ?? 0) > 0;

export const useMarketplaceViewModel = (): MarketplaceViewModel => {
  const { extensions, importExtension, removeExtension } = useTenantExtensions();
  const { installed, install, setActive: setInstalledActive, uninstall } = useInstalledExtensions();
  const { publicExtensions, publish: publishPublic, approve, deprecate, unpublish, publicOf } = usePublicExtensions();
  const { currentTenant, tenantRole } = useTenant();
  const { user, userRole } = useAuth();
  const { notify } = useNotification();
  const { openTab } = useWorkspace();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

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

  const privateCards = useMemo<PrivateCard[]>(
    () => extensions.map((ext) => {
      const copy = installed.find((i) => i.id === ext.id);
      return {
        id: ext.id,
        name: ext.package.manifest.name,
        summary: ext.package.summary,
        version: ext.package.manifest.version,
        hasCode: hasCodeOf(ext.package.views),
        publicStatus: publicOf(ext.id)?.status ?? null,
        installed: Boolean(copy),
        installOutdated: Boolean(copy && isVersionGreater(ext.package.manifest.version, copy.installedVersion)),
        author: { name: ext.createdByName ?? null, photoURL: ext.createdByPhotoURL ?? null },
      };
    }),
    [extensions, installed, publicOf],
  );

  const installedCards = useMemo<InstalledCard[]>(
    () => installed.map((ext) => {
      const update = updateSourceOf(ext.id, ext.installedVersion);
      return {
        id: ext.id,
        name: ext.package.manifest.name,
        summary: ext.package.summary,
        version: ext.installedVersion,
        active: ext.active,
        hasCode: hasCodeOf(ext.package.views),
        sourceLabel: ext.source === 'private' ? 'Da sua área privada' : 'Do catálogo público',
        updateAvailable: update !== null,
        updateVersion: update?.version ?? null,
        deprecated: publicOf(ext.id)?.status === 'deprecated',
        isAuthor: ext.authorId === user?.id,
        author: { name: ext.authorName || null, photoURL: ext.authorPhotoURL },
      };
    }),
    [installed, updateSourceOf, publicOf, user],
  );

  const publicCards = useMemo<PublicCard[]>(
    () => publicExtensions
      .filter((p) => p.status === 'approved')
      .map((p) => {
        const copy = installed.find((i) => i.id === p.domain);
        return {
          domain: p.domain,
          name: p.package.manifest.name,
          summary: p.package.summary,
          version: p.version,
          hasCode: p.hasCode,
          isAuthor: p.ownerTenantId === currentTenant?.id,
          installState: !copy ? 'none' : isVersionGreater(p.version, copy.installedVersion) ? 'update' : 'installed',
          author: { name: p.ownerName || null, photoURL: p.ownerPhotoURL },
        };
      }),
    [publicExtensions, installed, currentTenant],
  );

  const moderationCards = useMemo<ModerationCard[]>(
    () => (canModerate
      ? publicExtensions
        .filter((p) => p.status === 'pending')
        .map((p) => ({
          domain: p.domain,
          name: p.package.manifest.name,
          summary: p.package.summary,
          version: p.version,
          author: { name: p.ownerName || null, photoURL: p.ownerPhotoURL },
        }))
      : []),
    [publicExtensions, canModerate],
  );

  const editPrivate = useCallback((id: string) => openTab(`plugin-author:${id}`), [openTab]);

  const downloadPackage = useCallback((id: string, packageJson: string) => {
    const blob = new Blob([packageJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadPrivate = useCallback((id: string) => {
    const ext = extensions.find((e) => e.id === id);
    if (ext) downloadPackage(id, serializePackage(ext.package));
  }, [extensions, downloadPackage]);

  const downloadInstalled = useCallback((id: string) => {
    const ext = installed.find((e) => e.id === id);
    if (ext) downloadPackage(id, serializePackage(ext.package));
  }, [installed, downloadPackage]);

  const publishPrivate = useCallback(async (id: string) => {
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

  const installPrivate = useCallback((id: string) => {
    const input = privateInputOf(id);
    if (!input) return Promise.resolve();
    const isUpdate = installed.some((e) => e.id === id);
    return run(id, () => install(input), isUpdate ? 'Cópia atualizada no escritório.' : 'Instalada no escritório.');
  }, [privateInputOf, installed, run, install]);

  const installPublic = useCallback((domain: string) => {
    const input = publicInputOf(domain);
    if (!input) return Promise.resolve();
    const isUpdate = installed.some((e) => e.id === domain);
    return run(domain, () => install(input), isUpdate ? 'Extensão atualizada.' : 'Extensão instalada.');
  }, [publicInputOf, installed, run, install]);

  const updateInstalled = useCallback((id: string) => {
    const ext = installed.find((e) => e.id === id);
    if (!ext) return Promise.resolve();
    const input = updateSourceOf(id, ext.installedVersion);
    if (!input) return Promise.resolve();
    return run(id, () => install(input), 'Extensão atualizada.');
  }, [installed, updateSourceOf, run, install]);

  const toggleInstalledActive = useCallback(
    (id: string, active: boolean) => run(id, () => setInstalledActive(id, active), active ? 'Extensão ativada.' : 'Extensão desativada.'),
    [run, setInstalledActive],
  );

  const uninstallInstalled = useCallback(
    (id: string) => run(id, () => uninstall(id), 'Extensão desinstalada.'),
    [run, uninstall],
  );

  const approvePublic = useCallback((domain: string) => run(domain, () => approve(domain), 'Extensão aprovada.'), [run, approve]);
  const deprecatePublic = useCallback((domain: string) => run(domain, () => deprecate(domain), 'Extensão marcada como obsoleta.'), [run, deprecate]);
  const rejectPublic = useCallback((domain: string) => run(domain, () => unpublish(domain), 'Publicação recusada e removida do catálogo.'), [run, unpublish]);

  const requestRemovePrivate = useCallback((id: string) => {
    const ext = extensions.find((e) => e.id === id);
    setRemoveTarget({ id, name: ext?.package.manifest.name ?? id });
  }, [extensions]);

  const cancelRemovePrivate = useCallback(() => setRemoveTarget(null), []);

  const confirmRemovePrivate = useCallback(async () => {
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
    privateCards,
    installedCards,
    publicCards,
    moderationCards,
    busyId,
    removeTarget,
    openAuthor,
    onImportFile,
    editPrivate,
    downloadPrivate,
    publishPrivate,
    installPrivate,
    requestRemovePrivate,
    confirmRemovePrivate,
    cancelRemovePrivate,
    installPublic,
    toggleInstalledActive,
    updateInstalled,
    uninstallInstalled,
    downloadInstalled,
    approvePublic,
    deprecatePublic,
    rejectPublic,
  };
};
