import { useCallback, useMemo, useState } from 'react';
import { useTenantExtensions } from '../../../stores/useTenantExtensions';
import { useInstalledExtensions, type InstallExtensionInput } from '../../../stores/useInstalledExtensions';
import { usePublicExtensions } from '../../../stores/usePublicExtensions';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import { useWorkspace } from '../../../stores/useWorkspace';
import { packageFingerprint, serializePackage } from '../../../domain/usecases/plugins/packageSerialization';
import { isVersionGreater } from '../../../domain/usecases/plugins/publicExtension';
import { extensionCodeOf, extensionHasCode } from '../../../domain/usecases/plugins/extensionCodeTrust';
import { isExtensionBackendPending } from '../../../domain/usecases/plugins/extensionBackendState';
import { extensionMigrationError, isExtensionMigrationPending } from '../../../domain/usecases/plugins/extensionMigrationState';
import { useExtensionCodeTrust } from '../../../stores/useExtensionCodeTrust';
import { usePluginDiagnostics } from '../../../stores/useKernel';
import { MARKETPLACE_CATALOG } from '../../../plugins/marketplace/catalog';
import { SYSTEM_THEME_PACKAGES } from '../../../plugins/themes/systemThemes';
import type { MarketplacePlugin } from '../../../domain/entities/MarketplacePlugin';
import type { InstalledExtension } from '../../../domain/entities/InstalledExtension';

import { useT } from '../../shared/i18n/useT';
import { usePackageCatalog } from '../../shared/i18n/usePackageCatalog';
import { resolveLabel } from '../../../domain/schema/i18n/messageRef';
import type { MessageCatalog, MessageParams } from '../../../domain/schema/i18n/messages';

export interface Author {
  name: string | null;
  photoURL: string | null;
}

export type StatusBadge = 'published' | 'pending' | 'deprecated' | 'private' | 'builtin' | 'system';
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
  /** Descrição rica (Widget DSL) do pacote, exibida no modal de detalhes. */
  overview: unknown;
  description: string;

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

  /**
   * Instalada, mas exigindo do projeto Firebase o que só o Microteia Console cria — Cloud Function,
   * índice composto, credencial de backend. Ela NÃO está no ar: entra no boot só depois de
   * `microteia provision`. Sem este estado o sintoma seria a tela sumir do menu sem explicação, ou
   * pior, aparecer e falhar toda chamada ao servidor como se fosse CORS.
   */
  backendPending: boolean;
  /**
   * Instalada, com MIGRAÇÃO DE DADOS obrigatória em dívida. Também não está no ar: o servidor está lá,
   * mas o dado ainda não está no formato que as telas dela esperam. Ver `extensionMigrationState`.
   */
  migrationPending: boolean;
  /** O erro da última tentativa de migração, já resolvido para texto. Nulo quando nunca falhou. */
  migrationError: string | null;
  /** Há fila pendente E o usuário pode rodá-la (só admin) — o gesto de "Atualizar dados". */
  canRunMigrations: boolean;
  /** Código instalado que ainda não pode executar — falta a revisão de um admin do escritório. */
  needsCodeReview: boolean;
  /** Fonte do código, para o admin ler antes de confiar. */
  codeToReview: string | null;
  codeTrustedByName: string | null;

  mine: boolean;
  installed: boolean;
  isPublic: boolean;
  /** Vem do catálogo embutido no bundle — extensão de primeira parte, sempre disponível. */
  isBuiltin: boolean;
  /**
   * Faz PARTE do sistema: carregada com o Kernel, não instalada no escritório. Aparece aqui para
   * poder ser BAIXADA — é assim que se começa um tema próprio —, e por isso mesmo não oferece
   * instalar, desativar nem desinstalar: não há cópia no escritório para desfazer.
   */
  isSystem: boolean;
  /**
   * O que o Kernel recusou nesta extensão ao montar o escritório — dependência que falta, ponto de
   * extensão inexistente, versão incompatível. Instalada e ativa, mas com um erro aqui, ela NÃO
   * está no ar: sem isso o sintoma era a tela sumir do menu, sem nada que explicasse.
   */
  problems: ExtensionProblem[];
  /** Há erro (não só aviso): o plugin inteiro não carregou. */
  failed: boolean;
}

export interface ExtensionProblem {
  severity: string;
  message: string;
}

export type MarketplaceFilter = 'all' | 'installed' | 'mine' | 'catalog';

/** Índice do catálogo embutido — as extensões de primeira parte que viajam no bundle. */
const BUILTIN_BY_ID = new Map<string, MarketplacePlugin>(
  MARKETPLACE_CATALOG.map((plugin) => [plugin.manifest.id, plugin]),
);

/**
 * Os pacotes que viajam DENTRO do Kernel — hoje os dois temas do sistema. Nunca se instalam nem se
 * desinstalam, e é essa a razão de estarem aqui: quem procura "onde mexo no tema" procura em
 * Extensões, e uma lista que os escondesse mentiria sobre de onde a aparência vem.
 */
const SYSTEM_BY_ID = new Map<string, MarketplacePlugin>(
  SYSTEM_THEME_PACKAGES.map((plugin) => [plugin.manifest.id, plugin]),
);

export interface MarketplaceViewModel {
  canManage: boolean;
  /**
   * O catálogo desta tela: o do escritório com os textos dos pacotes LISTADOS por baixo. Vai para a
   * subárvore que resolve rótulo por conta própria — a descrição rica do modal de detalhes.
   */
  catalog: MessageCatalog;
  canModerate: boolean;
  rows: ExtensionRow[];
  filter: MarketplaceFilter;
  setFilter: (filter: MarketplaceFilter) => void;
  counts: Record<MarketplaceFilter, number>;
  busyId: string | null;
  removeTarget: { id: string; name: string } | null;
  reviewTarget: { id: string; name: string; code: string } | null;
  detailsRow: ExtensionRow | null;
  openDetails: (id: string) => void;
  closeDetails: () => void;
  openReview: (id: string) => void;
  confirmReview: () => Promise<void>;
  cancelReview: () => void;
  openAuthor: () => void;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  edit: (id: string) => void;
  download: (id: string) => void;
  publish: (id: string) => Promise<void>;
  install: (id: string) => Promise<void>;
  /** Roda a fila de migração de dados pendente da cópia instalada. */
  runMigrations: (id: string) => Promise<void>;
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
  const t = useT('core.marketplace');
  const { extensions, importExtension, removeExtension } = useTenantExtensions();
  const {
    installed,
    migrationStates,
    install: installCopy,
    setActive: setInstalledActive,
    trustCode,
    uninstall: uninstallCopy,
    pendingMigrationsOf,
    runMigrations: runExtensionMigrations,
  } = useInstalledExtensions();
  const { publicExtensions, publish: publishPublic, approve: approvePublic, deprecate: deprecatePublic, unpublish, publicOf } = usePublicExtensions();
  const { tenantRole } = useTenant();
  const { user, userRole } = useAuth();
  const { notify } = useNotification();
  const { openTab } = useWorkspace();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [filter, setFilter] = useState<MarketplaceFilter>('all');
  const [reviewTarget, setReviewTarget] = useState<{ id: string; name: string; code: string } | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const trustedIds = useExtensionCodeTrust(installed);

  /**
   * Todo pacote que esta tela pode mostrar, instalado ou não. É a lista de onde sai o catálogo de
   * fallback: sem ela, uma extensão do catálogo público — que ninguém instalou ainda — aparecia com
   * `com.microteia.news/package.name` no lugar do nome, porque o texto dela só entra no catálogo
   * global depois de instalada e ativa.
   */
  const marketplacePackages = useMemo(() => [
    ...SYSTEM_BY_ID.values(),
    ...BUILTIN_BY_ID.values(),
    ...extensions.map((extension) => extension.package),
    ...installed.map((extension) => extension.package),
    ...publicExtensions.map((extension) => extension.package),
  ], [extensions, installed, publicExtensions]);

  const catalog = usePackageCatalog(marketplacePackages);

  /**
   * O rótulo declarativo desta tela. É o `useLabel` de sempre, só que sobre o catálogo acima — o que
   * o escritório traduziu continua vencendo, e o pacote responde pelo que ninguém mais tem.
   */
  const label = useCallback(
    (value: string | null | undefined, params?: MessageParams) => resolveLabel(catalog, value, params),
    [catalog],
  );

  /**
   * Os diagnósticos do host, agrupados por extensão. O Kernel já os produzia a cada carga e ninguém
   * os lia: uma extensão que falhava por dependência simplesmente desaparecia do menu, em silêncio.
   */
  const diagnostics = usePluginDiagnostics();
  const problemsByPlugin = useMemo(() => {
    const byPlugin = new Map<string, ExtensionProblem[]>();
    for (const diagnostic of diagnostics) {
      if (!diagnostic.pluginId) continue;
      const list = byPlugin.get(diagnostic.pluginId) ?? [];
      list.push({ severity: diagnostic.severity, message: label(diagnostic.message, diagnostic.messageParams) });
      byPlugin.set(diagnostic.pluginId, list);
    }
    return byPlugin;
  }, [diagnostics, label]);

  /**
   * Cópias instaladas que têm código e ainda não podem executá-lo. Enquanto o hash não termina de ser
   * calculado, o conjunto de confiáveis vem vazio e tudo com código aparece como pendente — é o mesmo
   * "falha fechada" do host: melhor pedir revisão à toa do que rodar código não revisado.
   */
  const installedNeedsReview = useMemo(
    () => new Set(
      installed
        .filter((extension) => extensionHasCode(extension.package) && !trustedIds.has(extension.id))
        .map((extension) => extension.id),
    ),
    [installed, trustedIds],
  );

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
        console.error('[marketplace] extension operation failed:', err);
        notify(t('extension.operation-failed', { detail: detail }), 'error');
      } finally {
        setBusyId(null);
      }
    },
    [notify, t],
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

  /**
   * Entrada de instalação vinda do CATÁLOGO EMBUTIDO. Autoria é a do publisher declarado no manifest
   * — não há um usuário por trás, é código da aplicação.
   */
  const builtinInputOf = useCallback((id: string): InstallExtensionInput | null => {
    const plugin = BUILTIN_BY_ID.get(id);
    if (!plugin) return null;
    return {
      package: plugin,
      source: 'builtin',
      version: plugin.manifest.version,
      authorId: '',
      authorName: plugin.manifest.publisher?.name ?? 'Microteia',
      authorPhotoURL: null,
    };
  }, []);

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

  /**
   * Reinstalar do bundle é oferecido sempre que o pacote embutido DIFERE do instalado — e não só
   * quando a versão sobe. Durante o desenvolvimento de uma extensão de primeira parte a versão
   * costuma ficar parada enquanto o código muda; comparar o conteúdo é o que faz o botão aparecer
   * na hora certa.
   */
  const builtinUpdateOf = useCallback((id: string, inst: { package: MarketplacePlugin }): InstallExtensionInput | null => {
    const input = builtinInputOf(id);
    if (!input) return null;
    // Impressão CANÔNICA dos dois lados: a cópia instalada volta do Firestore com as chaves em outra
    // ordem, e uma comparação literal acusaria atualização a cada render.
    return packageFingerprint(input.package) === packageFingerprint(inst.package) ? null : input;
  }, [builtinInputOf]);

  /**
   * O erro da última migração já resolvido para texto — ele nasce no domínio como referência de
   * mensagem, e é a tela que conhece o idioma de quem lê.
   */
  const migrationErrorOf = useCallback(
    (extension: InstalledExtension | undefined): string | null => {
      const failure = extension ? extensionMigrationError(extension, migrationStates) : null;
      return failure ? label(failure.message, failure.messageParams) : null;
    },
    [migrationStates, label],
  );

  const rows = useMemo<ExtensionRow[]>(() => {
    const ids = new Set<string>();
    extensions.forEach((e) => ids.add(e.id));
    installed.forEach((i) => ids.add(i.id));
    publicExtensions.forEach((p) => { if (p.status === 'approved' || canModerate) ids.add(p.domain); });
    BUILTIN_BY_ID.forEach((_, id) => ids.add(id));

    const list: ExtensionRow[] = [];

    for (const [id, pkg] of SYSTEM_BY_ID) {
      list.push({
        id,
        name: label(pkg.manifest.name),
        summary: label(pkg.summary),
        version: pkg.manifest.version,
        author: { name: pkg.manifest.publisher?.name ?? null, photoURL: null },
        hasCode: false,
        overview: pkg.overview ?? null,
        description: label(pkg.manifest.description ?? ''),
        installBadge: 'active',
        statusBadge: 'system',
        updateAvailable: false,
        canEdit: false,
        install: null,
        active: true,
        canToggleActive: false,
        published: false,
        canPublish: false,
        canDownload: true,
        canUninstall: false,
        canDelete: false,
        canApprove: false,
        canDeprecate: false,
        needsCodeReview: false,
        codeToReview: null,
        backendPending: false,
        migrationPending: false,
        migrationError: null,
        canRunMigrations: false,
        codeTrustedByName: null,
        mine: false,
        installed: true,
        isPublic: false,
        isBuiltin: false,
        isSystem: true,
        problems: problemsByPlugin.get(id) ?? [],
        failed: false,
      });
    }

    for (const id of ids) {
      if (SYSTEM_BY_ID.has(id)) continue;
      const priv = extensions.find((e) => e.id === id);
      const inst = installed.find((i) => i.id === id);
      const pub = publicOf(id);
      const builtin = BUILTIN_BY_ID.get(id) ?? null;

      const mine = Boolean(priv);
      const installed_ = Boolean(inst);
      const publicStatus = pub?.status ?? null;
      const isApproved = publicStatus === 'approved';

      const pkg = inst?.package ?? priv?.package ?? pub?.package ?? builtin;
      if (!pkg) continue;

      const author: Author = inst
        ? { name: inst.authorName || null, photoURL: inst.authorPhotoURL }
        : priv
          ? { name: priv.createdByName ?? null, photoURL: priv.createdByPhotoURL ?? null }
          : { name: pub?.ownerName || null, photoURL: pub?.ownerPhotoURL ?? null };

      const updateAvailable = inst
        ? (updateSourceOf(id, inst.installedVersion) !== null || (!!builtin && builtinUpdateOf(id, inst) !== null))
        : false;
      const install: InstallAction | null = inst
        ? (updateAvailable ? 'update' : null)
        : (mine || isApproved || !!builtin ? 'install' : null);

      const problems = problemsByPlugin.get(id) ?? [];

      const statusBadge: StatusBadge | null = publicStatus === 'approved' ? 'published'
        : publicStatus === 'pending' ? 'pending'
          : publicStatus === 'deprecated' ? 'deprecated'
            : mine ? 'private' : builtin ? 'builtin' : null;

      list.push({
        id,
        // O pacote pode declarar o texto como REFERÊNCIA de mensagem — é como um pacote nosso fica
        // traduzível sem que o Marketplace precise saber o que ele é. Texto literal passa intacto.
        name: label(pkg.manifest.name),
        summary: label(pkg.summary),
        version: inst?.installedVersion ?? priv?.package.manifest.version ?? pub?.version ?? builtin?.manifest.version ?? '',
        author,
        hasCode: hasCodeOf(pkg.views),
        overview: pkg.overview ?? null,
        description: label(pkg.manifest.description ?? ''),
        installBadge: inst ? (inst.active ? 'active' : 'inactive') : null,
        statusBadge,
        updateAvailable,
        canEdit: mine,
        install,
        active: inst?.active ?? false,
        canToggleActive: installed_,
        published: publicStatus !== null,
        canPublish: mine,
        // Do embutido também: é o pacote que o `npm run build:extensions` gera, útil para levar a
        // extensão a um escritório que não roda este bundle.
        canDownload: mine || !!builtin || Boolean(inst && inst.authorId === user?.id),
        canUninstall: installed_,
        canDelete: mine,
        canApprove: canModerate && publicStatus === 'pending',
        canDeprecate: canModerate && publicStatus === 'approved',
        backendPending: inst !== undefined && inst !== null && isExtensionBackendPending(inst),
        migrationPending: inst ? isExtensionMigrationPending(inst, migrationStates) : false,
        migrationError: migrationErrorOf(inst),
        canRunMigrations: canManage && inst !== undefined && pendingMigrationsOf(id).length > 0,
        needsCodeReview: Boolean(inst) && installedNeedsReview.has(id),
        codeToReview: inst ? extensionCodeOf(inst.package) : null,
        codeTrustedByName: inst?.codeTrust?.trustedByName ?? null,
        mine,
        installed: installed_,
        isPublic: isApproved,
        isBuiltin: !!builtin,
        isSystem: false,
        problems,
        failed: problems.some((problem) => problem.severity === 'error'),
      });
    }

    return list.sort((a, b) => rankOf(a) - rankOf(b) || a.name.localeCompare(b.name));
  }, [extensions, installed, publicExtensions, publicOf, updateSourceOf, builtinUpdateOf, canModerate, canManage, user, installedNeedsReview, problemsByPlugin, label, migrationStates, pendingMigrationsOf, migrationErrorOf]);

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
    // O do sistema vem primeiro: ele não tem cópia privada nem instalada, e baixá-lo é o primeiro
    // passo de quem vai fazer um tema próprio a partir do nosso.
    const system = SYSTEM_BY_ID.get(id);
    if (system) { downloadPackage(id, serializePackage(system)); return; }
    const priv = extensions.find((e) => e.id === id);
    if (priv) { downloadPackage(id, serializePackage(priv.package)); return; }
    const inst = installed.find((e) => e.id === id);
    if (inst) { downloadPackage(id, serializePackage(inst.package)); return; }
    const builtin = BUILTIN_BY_ID.get(id);
    if (builtin) downloadPackage(id, serializePackage(builtin));
  }, [extensions, installed, downloadPackage]);

  const publish = useCallback(async (id: string) => {
    const ext = extensions.find((e) => e.id === id);
    if (!ext) return;
    setBusyId(id);
    try {
      const result = await publishPublic(ext.package);
      if (!result.ok) notify(label(result.error), 'error');
      else if (result.status === 'pending') {
        notify(t('extension.sent-for-approval'), 'warning');
      } else notify(t('extension.published'), 'success');
    } catch (err) {
      notify(t('extension.publish-failed', { detail: err instanceof Error ? err.message : String(err) }), 'error');
    } finally {
      setBusyId(null);
    }
  }, [extensions, publishPublic, notify, t, label]);

  const install = useCallback((id: string) => {
    const inst = installed.find((e) => e.id === id);
    if (inst) {
      const input = updateSourceOf(id, inst.installedVersion) ?? builtinUpdateOf(id, inst);
      if (!input) return Promise.resolve();
      return run(id, () => installCopy(input), t('extension.updated'));
    }
    const input = privateInputOf(id) ?? publicInputOf(id) ?? builtinInputOf(id);
    if (!input) return Promise.resolve();
    return run(id, () => installCopy(input), t('extension.installed'));
  }, [installed, updateSourceOf, builtinUpdateOf, privateInputOf, publicInputOf, builtinInputOf, run, installCopy, t]);

  /**
   * Roda a fila pendente. `run` já cuida do ocupado/erro; a mensagem de sucesso diz o que aconteceu,
   * porque uma migração bem-sucedida não muda nada visível na tela além de a extensão voltar ao ar.
   */
  const runMigrations = useCallback(
    (id: string) => {
      const row = installed.find((extension) => extension.id === id);
      const name = row ? label(row.package.manifest.name) : id;
      if (pendingMigrationsOf(id).length === 0) {
        notify(t('migration.up-to-date', { name }), 'info');
        return Promise.resolve();
      }
      return run(id, () => runExtensionMigrations(id), t('migration.ran', { name }));
    },
    [installed, pendingMigrationsOf, runExtensionMigrations, run, notify, t, label],
  );

  const toggleActive = useCallback(
    (id: string, active: boolean) => run(id, () => setInstalledActive(id, active), active ? t('extension.activated') : t('extension.deactivated')),
    [run, setInstalledActive, t],
  );

  const uninstall = useCallback(
    (id: string) => run(id, () => uninstallCopy(id), t('extension.uninstalled')),
    [run, uninstallCopy, t],
  );

  const approve = useCallback((id: string) => run(id, () => approvePublic(id), t('extension.approved')), [run, approvePublic, t]);
  const deprecate = useCallback((id: string) => run(id, () => deprecatePublic(id), t('extension.deprecated')), [run, deprecatePublic, t]);
  const reject = useCallback((id: string) => run(id, () => unpublish(id), t('extension.rejected')), [run, unpublish, t]);

  const requestRemove = useCallback((id: string) => {
    const ext = extensions.find((e) => e.id === id);
    setRemoveTarget({ id, name: ext ? label(ext.package.manifest.name) : id });
  }, [extensions, label]);

  const cancelRemove = useCallback(() => setRemoveTarget(null), []);

  const openReview = useCallback((id: string) => {
    const extension = installed.find((candidate) => candidate.id === id);
    if (!extension) return;
    setReviewTarget({
      id,
      name: label(extension.package.manifest.name),
      code: extensionCodeOf(extension.package) ?? '',
    });
  }, [installed, label]);

  const cancelReview = useCallback(() => setReviewTarget(null), []);

  const openDetails = useCallback((id: string) => setDetailsId(id), []);
  const closeDetails = useCallback(() => setDetailsId(null), []);

  const detailsRow = useMemo(
    () => rows.find((row) => row.id === detailsId) ?? null,
    [rows, detailsId],
  );

  const confirmReview = useCallback(async () => {
    if (!reviewTarget) return;
    const { id } = reviewTarget;
    setReviewTarget(null);
    await run(id, () => trustCode(id), t('extension.trusted'));
  }, [reviewTarget, run, trustCode, t]);

  const confirmRemove = useCallback(async () => {
    if (!removeTarget) return;
    const { id } = removeTarget;
    setRemoveTarget(null);
    await run(id, () => removeExtension(id), t('extension.removed'));
  }, [removeTarget, run, removeExtension, t]);

  const onImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusyId('__import__');
    try {
      const result = await importExtension(await file.text());
      if (result.ok) notify(t('extension.imported', { name: result.name }), 'success');
      else notify(t('extension.import-failed', { detail: label(result.error, result.errorParams) }), 'error');
    } catch (err) {
      notify(t('extension.import-failed', { detail: err instanceof Error ? err.message : String(err) }), 'error');
    } finally {
      setBusyId(null);
    }
  }, [importExtension, notify, t, label]);

  return {
    canManage,
    canModerate,
    catalog,
    rows: visibleRows,
    filter,
    setFilter,
    counts,
    busyId,
    removeTarget,
    reviewTarget,
    detailsRow,
    openDetails,
    closeDetails,
    openReview,
    confirmReview,
    cancelReview,
    openAuthor,
    onImportFile,
    edit,
    download,
    publish,
    install,
    runMigrations,
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
