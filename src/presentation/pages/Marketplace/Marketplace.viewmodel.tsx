import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenantExtensions } from '../../../stores/useTenantExtensions';
import { useInstalledExtensions, type InstallExtensionInput } from '../../../stores/useInstalledExtensions';
import { usePublicExtensions } from '../../../stores/usePublicExtensions';
import { useAuthorization } from '../../../stores/useAuthorization';
import { PERMISSION_EXTENSIONS_MANAGE } from '../../../domain/schema/access';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import { useWorkspace } from '../../../stores/useWorkspace';
import { packageFingerprint, serializePackage } from '../../../domain/usecases/plugins/packageSerialization';
import { isVersionGreater } from '../../../domain/usecases/plugins/publicExtension';
import { extensionCodeOf, extensionHasCode } from '../../../domain/usecases/plugins/extensionCodeTrust';
import { isExtensionBackendPending } from '../../../domain/usecases/plugins/extensionBackendState';
import { backendResidueCount } from '../../../domain/usecases/plugins/backendResidue';
import { useDI } from '../../../infrastructure/di/useDI';
import type { BackendResidue } from '../../../domain/entities/BackendResidue';
import { extensionMigrationError, isExtensionMigrationPending } from '../../../domain/usecases/plugins/extensionMigrationState';
import { licenseOf } from '../../../domain/usecases/plugins/pluginLicenses';
import { wrappedErrorParams } from '../../../domain/errors/LocalizedError';
import { useExtensionCodeTrust } from '../../../stores/useExtensionCodeTrust';
import { useInstalledRevision } from '../../../stores/useInstalledRevision';
import { EXTENSION_HISTORY_LIMIT } from '../../../domain/usecases/plugins/extensionHistory';
import { usePluginDiagnostics } from '../../../stores/useKernel';
import { useExtensionUpdates } from '../../shared/useExtensionUpdates';
import { MARKETPLACE_CATALOG } from '../../../plugins/marketplace/catalog';
import { SYSTEM_THEME_PACKAGES } from '../../../plugins/themes/systemThemes';
import type { MarketplacePlugin } from '../../../domain/entities/MarketplacePlugin';
import type { InstalledExtension } from '../../../domain/entities/InstalledExtension';
import type { WidgetSpec } from '../../../domain/schema/ui/widgetSpec';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

import { useT, useLocaleFormat } from '../../shared/i18n/useT';
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
  /**
   * Os TERMOS DE LICENÇA do manifest, ou `null` em quem não tem nenhum que desenhe. Ver `licenseOf`.
   */
  license: WidgetSpec | null;
  description: string;
  /**
   * A categoria declarada no manifest, crua — é ela que o filtro compara. Nula em quem não declarou
   * nenhuma: a categoria é opcional, e inventar uma para quem não a tem esconderia o fato.
   */
  category: string | null;
  /** A mesma categoria já resolvida para o idioma de quem lê — é o que a linha mostra. */
  categoryLabel: string | null;

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
  /**
   * Há versão aplicada registrada para esta extensão neste escritório. Sobrevive à desinstalação: é
   * o que permite trazer de volta a última que o escritório tinha.
   */
  hasHistory: boolean;
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

/**
 * O valor da opção "sem categoria" do filtro. Um sentinela porque `FilterToken` só carrega texto, e
 * ausência de categoria precisa ser escolhível como qualquer outra — é o recorte de quem quer ver o
 * que ainda não foi classificado.
 */
const UNCATEGORIZED = '__uncategorized__';

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

/** O resíduo de backend na forma em que a tela o mostra: quanto sobrou, e a tarja já resolvida. */
export interface BackendResidueSummary {
  /** Quantos artefatos sobraram. É o que decide se a tarja aparece. */
  count: number;
  message: string;
}

/** Uma versão já aplicada, como a tela a lista. */
export interface HistoryVersionRow {
  revision: string;
  version: string;
  /** A frase pronta com quem aplicou e quando — a tela é quem conhece o idioma de quem lê. */
  appliedBy: string;
  /**
   * É a versão que está no ar agora. Falsa enquanto a revisão da cópia instalada ainda está sendo
   * calculada — o hash é assíncrono, e chega num segundo render.
   */
  current: boolean;
}

/** O histórico de UMA extensão, aberto no modal. */
export interface HistoryPanel {
  id: string;
  name: string;
  /** A extensão não está instalada: aplicar uma versão daqui é o que a traz de volta. */
  uninstalled: boolean;
  versions: HistoryVersionRow[];
  /** Quantas versões o histórico guarda — a frase de rodapé é derivada daqui, nunca escrita à mão. */
  limit: number;
}

export interface MarketplaceViewModel {
  canManage: boolean;
  /**
   * O que o provisionamento deixou para trás no projeto, ou `null` quando não há nada a retirar (ou
   * quando o Console nunca rodou aqui). É o par do selo "Backend pendente": aquele é a INSTALAÇÃO que
   * ainda não chegou ao projeto, este é a RETIRADA que ainda não aconteceu.
   */
  residue: BackendResidueSummary | null;
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
  /**
   * O filtro fino da aba "Todas". Ele existe só ali porque as outras três abas JÁ SÃO um recorte:
   * oferecer "instalada: não" dentro de "Instaladas" seria oferecer o vazio.
   */
  filterDefs: FilterDef[];
  filterTokens: FilterToken[];
  setFilterTokens: (tokens: FilterToken[]) => void;
  savedFiltersScreenKey: string;
  busyId: string | null;
  removeTarget: { id: string; name: string } | null;
  reviewTarget: { id: string; name: string; code: string } | null;
  detailsRow: ExtensionRow | null;
  openDetails: (id: string) => void;
  closeDetails: () => void;
  /** A extensão cujos termos de licença estão abertos — o modal do ícone de licença do cartão. */
  licenseRow: ExtensionRow | null;
  openLicense: (id: string) => void;
  closeLicense: () => void;
  openReview: (id: string) => void;
  confirmReview: () => Promise<void>;
  cancelReview: () => void;
  /** O histórico aberto, ou `null`. Ver `HistoryPanel`. */
  history: HistoryPanel | null;
  openHistory: (id: string) => void;
  closeHistory: () => void;
  restore: (id: string, revision: string) => Promise<void>;
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

/** Sim e Não escolhidos ao mesmo tempo devolvem tudo — é o que escolher os dois quer dizer. */
const matchesBoolean = (values: string[], actual: boolean): boolean =>
  values.some((value) => (value === 'yes') === actual);

/**
 * A linha contra os tokens: OU dentro de um campo, E entre campos — o mesmo contrato do
 * `CompositeFilter` em toda tela que o usa. Campo desconhecido não recusa nada: um filtro salvo de
 * uma versão anterior desta tela continua abrindo, só sem o recorte que já não existe.
 *
 * `categoryLabelOf` resolve o valor guardado no token. Categoria se compara pelo TEXTO, e não pela
 * referência que a declarou: duas extensões que dizem "Integração" estão na mesma categoria, ainda
 * que cada uma aponte para o próprio catálogo — o campo é livre, e é o texto que o leitor vê. O
 * token continua guardando a referência, que não muda quando o escritório troca de idioma.
 */
const matchesTokens = (
  row: ExtensionRow,
  tokens: FilterToken[],
  categoryLabelOf: (value: string) => string,
): boolean =>
  tokens.every(({ key, values }) => {
    if (values.length === 0) return true;
    switch (key) {
      case 'search': {
        const term = (values[0] ?? '').trim().toLowerCase();
        return term === ''
          || [row.name, row.summary, row.id].some((text) => text.toLowerCase().includes(term));
      }
      // Ativa/inativa é estado da CÓPIA instalada: quem não tem cópia não é nem uma coisa nem outra.
      case 'state': return row.installBadge !== null && values.includes(row.installBadge);
      case 'visibility': return values.some((value) => (value === 'private' ? row.mine : row.isPublic));
      case 'builtin': return matchesBoolean(values, row.isBuiltin);
      case 'code': return matchesBoolean(values, row.hasCode);
      case 'system': return matchesBoolean(values, row.isSystem);
      case 'category': return row.categoryLabel === null
        ? values.includes(UNCATEGORIZED)
        : values.map(categoryLabelOf).includes(row.categoryLabel);
      case 'update': return matchesBoolean(values, row.updateAvailable);
      case 'installation': return matchesBoolean(values, row.installed);
      default: return true;
    }
  });

const rankOf = (row: ExtensionRow): number => (row.installed ? 0 : row.mine ? 1 : 2);

export const useMarketplaceViewModel = (): MarketplaceViewModel => {
  const t = useT('core.marketplace');
  const { formatDateTime } = useLocaleFormat();
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
    histories,
    restore: restoreVersion,
  } = useInstalledExtensions();
  const { publicExtensions, publish: publishPublic, approve: approvePublic, deprecate: deprecatePublic, unpublish, publicOf } = usePublicExtensions();
  const { can } = useAuthorization();
  const { user, userRole } = useAuth();
  const { notify } = useNotification();
  const { openTab } = useWorkspace();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [filter, setFilter] = useState<MarketplaceFilter>('all');
  const [reviewTarget, setReviewTarget] = useState<{ id: string; name: string; code: string } | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [licenseId, setLicenseId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);

  const {
    ready: updatesReady,
    pendingIds: pendingUpdateIds,
    pendingInUse: pendingUpdatesInUse,
  } = useExtensionUpdates();
  const [entryFilterDecided, setEntryFilterDecided] = useState(false);

  /**
   * Entrar JÁ RECORTADO por "Atualização: sim" quando há alguma à espera — e sem recorte nenhum
   * quando não há. É o gesto que o selo promete: quem clica no selo vem atualizar, e chegar na lista
   * inteira obrigaria a refazer à mão o recorte que o selo acabou de anunciar.
   *
   * A decisão é de ENTRADA e acontece UMA vez, quando as três origens da atualização terminam de
   * carregar: antes disso a contagem é zero por não se saber ainda, e depois disso o recorte é de
   * quem está olhando — aplicar a última atualização não pode tirar da tela o filtro que a pessoa
   * está usando.
   */
  useEffect(() => {
    if (entryFilterDecided || !updatesReady) return;
    /* eslint-disable react-hooks/set-state-in-effect -- a decisão de entrada só pode ser tomada quando as origens carregam, e é o carregamento que a dispara */
    setEntryFilterDecided(true);
    if (pendingUpdatesInUse > 0) setFilterTokens([{ key: 'update', values: ['yes'] }]);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [entryFilterDecided, updatesReady, pendingUpdatesInUse]);

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

  const canManage = can(PERMISSION_EXTENSIONS_MANAGE);
  /**
   * O resíduo é lido UMA vez, e só por quem pode agir sobre ele.
   *
   * Ele não é dado do escritório e não muda por nada que se faça nesta tela: quem o escreve é o
   * Microteia Console, num terminal. Assinar o documento custaria uma conexão viva para observar algo
   * que muda quando alguém roda um comando — e a tela é reaberta muito mais vezes que isso.
   */
  const { backendResidueRepository } = useDI();
  const [residueState, setResidueState] = useState<BackendResidue | null>(null);

  useEffect(() => {
    if (!canManage) return undefined;
    let cancelled = false;
    void backendResidueRepository.get().then((found) => {
      if (!cancelled) setResidueState(found);
    });
    return () => { cancelled = true; };
  }, [canManage, backendResidueRepository]);

  const residue = useMemo<BackendResidueSummary | null>(() => {
    const count = backendResidueCount(residueState);
    if (residueState === null || count === 0) return null;

    // A contagem da varredura vai junto porque a afirmação é sobre TODOS os escritórios do projeto, e
    // não sobre o último que foi lido. Sem ela, quem lê a tarja só pode acreditar nela.
    const scanned = residueState.scannedAt === null
      ? ''
      : ` ${t('marketplace.residue.scanned', {
        date: formatDateTime(residueState.scannedAt),
        tenants: residueState.tenants,
        extensions: residueState.extensions,
      })}`;

    return {
      count,
      message: t('marketplace.residue', {
        count,
        functions: residueState.orphanFunctions.length,
        indexes: residueState.orphanIndexes.length,
      }) + scanned,
    };
  }, [residueState, t, formatDateTime]);

  const openAuthor = useCallback(() => openTab('plugin-author'), [openTab]);

  const run = useCallback(
    async (id: string, action: () => Promise<void>, successMessage: string) => {
      setBusyId(id);
      try {
        await action();
        notify(successMessage, 'success');
      } catch (err) {
        console.error('[marketplace] extension operation failed:', err);
        notify(t('extension.operation-failed', wrappedErrorParams(err)), 'error');
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
        license: licenseOf(pkg.manifest),
        description: label(pkg.manifest.description ?? ''),
        category: pkg.manifest.category ?? null,
        categoryLabel: pkg.manifest.category ? label(pkg.manifest.category) : null,
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
        hasHistory: false,
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

      // A MESMA resposta que alimenta o selo da barra lateral e o do alto da tela — ver
      // `useExtensionUpdates`. Era calculada aqui, e um número que discordasse do que esta linha
      // mostra seria pior do que número nenhum.
      const updateAvailable = pendingUpdateIds.has(id);
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
        license: licenseOf(pkg.manifest),
        description: label(pkg.manifest.description ?? ''),
        category: pkg.manifest.category ?? null,
        categoryLabel: pkg.manifest.category ? label(pkg.manifest.category) : null,
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
        hasHistory: canManage && (histories.get(id)?.entries.length ?? 0) > 0,
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
  }, [extensions, installed, publicExtensions, publicOf, pendingUpdateIds, canModerate, canManage, user, installedNeedsReview, problemsByPlugin, label, migrationStates, pendingMigrationsOf, migrationErrorOf, histories]);

  const counts = useMemo<Record<MarketplaceFilter, number>>(() => ({
    all: rows.length,
    installed: rows.filter((r) => r.installed).length,
    mine: rows.filter((r) => r.mine).length,
    catalog: rows.filter((r) => r.isPublic).length,
  }), [rows]);

  /**
   * As categorias que os pacotes LISTADOS declaram — nunca uma lista nossa. Categoria é campo livre
   * do manifest, e derivar as opções do que está na tela é o que faz a categoria de uma extensão de
   * terceiro aparecer aqui sem que o núcleo precise conhecê-la. A opção "sem categoria" só existe
   * quando há alguém sem ela: um recorte que devolve o vazio não é escolha, é engano.
   */
  const categoryOptions = useMemo(() => {
    // Indexado pelo TEXTO, com a primeira referência que o produziu como valor: dois pacotes que
    // dizem a mesma coisa são uma opção só, e não duas linhas idênticas que recortam metade cada.
    const byLabel = new Map<string, string>();
    let uncategorized = false;
    for (const row of rows) {
      if (row.category === null) uncategorized = true;
      else if (!byLabel.has(row.categoryLabel ?? row.category)) {
        byLabel.set(row.categoryLabel ?? row.category, row.category);
      }
    }
    const declared = [...byLabel.entries()]
      .map(([text, value]) => ({ value, label: text }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return uncategorized
      ? [...declared, { value: UNCATEGORIZED, label: t('filter.category.none') }]
      : declared;
  }, [rows, t]);

  const booleanOptions = useMemo(
    () => [
      { value: 'yes', label: t('core.ui/boolean.yes') },
      { value: 'no', label: t('core.ui/boolean.no') },
    ],
    [t],
  );

  const filterDefs = useMemo<FilterDef[]>(() => [
    {
      key: 'search',
      label: t('core.ui/filter.search'),
      type: 'text',
      placeholder: t('filter.search.placeholder'),
    },
    {
      key: 'state',
      label: t('core.ui/filter.status'),
      type: 'select',
      options: [
        { value: 'active', label: t('extension.badge.active') },
        { value: 'inactive', label: t('extension.badge.inactive') },
      ],
    },
    {
      key: 'visibility',
      label: t('filter.visibility'),
      type: 'select',
      options: [
        { value: 'private', label: t('status.private') },
        { value: 'public', label: t('status.published') },
      ],
    },
    { key: 'builtin', label: t('status.builtin'), type: 'select', options: booleanOptions },
    { key: 'code', label: t('extension.badge.has-code'), type: 'select', options: booleanOptions },
    { key: 'system', label: t('status.system'), type: 'select', options: booleanOptions },
    { key: 'category', label: t('core.ui/filter.category'), type: 'select', options: categoryOptions },
    { key: 'update', label: t('extension.badge.update'), type: 'select', options: booleanOptions },
    {
      key: 'installation',
      label: t('filter.installation'),
      type: 'select',
      options: [
        { value: 'yes', label: t('filter.installation.yes') },
        { value: 'no', label: t('filter.installation.no') },
      ],
    },
  ], [t, booleanOptions, categoryOptions]);

  const visibleRows = useMemo<ExtensionRow[]>(() => {
    switch (filter) {
      case 'installed': return rows.filter((r) => r.installed);
      case 'mine': return rows.filter((r) => r.mine);
      case 'catalog': return rows.filter((r) => r.isPublic);
      default: return rows.filter((r) => matchesTokens(r, filterTokens, label));
    }
  }, [rows, filter, filterTokens, label]);

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
      notify(t('extension.publish-failed', wrappedErrorParams(err)), 'error');
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

  const openLicense = useCallback((id: string) => setLicenseId(id), []);
  const closeLicense = useCallback(() => setLicenseId(null), []);

  const licenseRow = useMemo(
    () => rows.find((row) => row.id === licenseId) ?? null,
    [rows, licenseId],
  );

  const openHistory = useCallback((id: string) => setHistoryId(id), []);
  const closeHistory = useCallback(() => setHistoryId(null), []);

  /**
   * A revisão do que está instalado é calculada só para a extensão cujo histórico está aberto: é
   * um SHA-256 sobre o pacote inteiro, e fazê-lo para todas as instaladas a cada mudança pagaria
   * megabytes de digestão por uma pergunta que só existe com o modal na tela.
   */
  const historyPackage = useMemo(
    () => (historyId ? installed.find((extension) => extension.id === historyId)?.package ?? null : null),
    [historyId, installed],
  );
  const currentRevision = useInstalledRevision(historyPackage);

  const history = useMemo<HistoryPanel | null>(() => {
    if (!historyId) return null;
    const row = rows.find((candidate) => candidate.id === historyId);
    const entries = histories.get(historyId)?.entries ?? [];
    return {
      id: historyId,
      name: row?.name ?? historyId,
      uninstalled: !row?.installed,
      limit: EXTENSION_HISTORY_LIMIT,
      versions: entries.map((entry) => ({
        revision: entry.revision,
        version: entry.version,
        appliedBy: t('history.applied-by', {
          name: entry.appliedByName || entry.appliedBy,
          date: formatDateTime(entry.appliedAt),
        }),
        current: currentRevision !== null && entry.revision === currentRevision,
      })),
    };
  }, [historyId, rows, histories, currentRevision, t, formatDateTime]);

  /**
   * Voltar a uma versão. Fecha o modal antes de correr porque a lista dele é a mesma que a aplicação
   * vai reordenar — deixá-lo aberto mostraria o estado intermediário como se fosse o final.
   */
  const restore = useCallback(
    (id: string, revision: string) => {
      const entry = histories.get(id)?.entries.find((candidate) => candidate.revision === revision);
      setHistoryId(null);
      return run(id, () => restoreVersion(id, revision), t('history.applied', { version: entry?.version ?? '' }));
    },
    [histories, run, restoreVersion, t],
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
      notify(t('extension.import-failed', wrappedErrorParams(err)), 'error');
    } finally {
      setBusyId(null);
    }
  }, [importExtension, notify, t, label]);

  return {
    canManage,
    residue,
    canModerate,
    catalog,
    rows: visibleRows,
    filter,
    setFilter,
    counts,
    filterDefs,
    filterTokens,
    setFilterTokens,
    savedFiltersScreenKey: 'marketplace',
    busyId,
    removeTarget,
    reviewTarget,
    detailsRow,
    openDetails,
    closeDetails,
    licenseRow,
    openLicense,
    closeLicense,
    openReview,
    confirmReview,
    cancelReview,
    history,
    openHistory,
    closeHistory,
    restore,
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
