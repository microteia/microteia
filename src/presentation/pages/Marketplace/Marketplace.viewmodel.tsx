import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenantExtensions } from '../../../stores/useTenantExtensions';
import { useTenant } from '../../../stores/useTenant';
import { useInstalledExtensions, type InstallExtensionInput } from '../../../stores/useInstalledExtensions';
import { usePublicExtensions } from '../../../stores/usePublicExtensions';
import { useAuthorization } from '../../../stores/useAuthorization';
import { PERMISSION_EXTENSIONS_MANAGE } from '../../../domain/schema/access';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import { useWorkspace } from '../../../stores/useWorkspace';
import { packageFingerprint, parsePackage, serializePackage } from '../../../domain/usecases/plugins/packageSerialization';
import {
  canPublishPublicly,
  extensionHasServerCode,
  isVersionGreater,
  publishRefusal,
} from '../../../domain/usecases/plugins/publicExtension';
import { extensionHasCode } from '../../../domain/usecases/plugins/extensionCodeTrust';
import {
  extensionBackendPendingCause,
  isExtensionBackendPending,
} from '../../../domain/usecases/plugins/extensionBackendState';
import type { ExtensionBackendPending } from '../../../domain/entities/InstalledExtension';
import type { BackendPendingReason } from '../../../domain/schema/plugin/backendRequirement';
import { backendResidueCount } from '../../../domain/usecases/plugins/backendResidue';
import { useDI } from '../../../infrastructure/di/useDI';
import type { BackendResidue } from '../../../domain/entities/BackendResidue';
import { extensionMigrationError, isExtensionMigrationPending } from '../../../domain/usecases/plugins/extensionMigrationState';
import { licenseOf } from '../../../domain/usecases/plugins/pluginLicenses';
import { isAuthoredHere } from '../../../domain/usecases/plugins/extensionOrigin';
import {
  compareByMetric,
  extensionGlyphOf,
  extensionImageOf,
  publisherVerificationOf,
  ratingAverage,
  starsOf,
  MAX_STARS,
} from '../../../domain/usecases/plugins/extensionReputation';
import type { PublisherVerification, StarKind } from '../../../domain/usecases/plugins/extensionReputation';
import { wrappedErrorParams } from '../../../domain/errors/LocalizedError';
import { DependencyRangeRefusal } from '../../../domain/usecases/plugins/crossExtensionRefs';
import type { LocalizedIssue } from '../../../domain/usecases/plugins/pluginReferences';
import { useInstalledCodeTrust } from '../../../stores/useExtensionCodeTrust';
import { useInstalledRevision } from '../../../stores/useInstalledRevision';
import { EXTENSION_HISTORY_LIMIT } from '../../../domain/usecases/plugins/extensionHistory';
import { usePluginDiagnostics } from '../../../stores/useKernel';
import { useExtensionPendencies } from '../../shared/useExtensionPendencies';
import type { ExtensionPendency } from '../../../domain/usecases/plugins/extensionPendencies';
import { MARKETPLACE_CATALOG } from '../../../plugins/marketplace/catalog';
import { SYSTEM_THEME_PACKAGES } from '../../../plugins/themes/systemThemes';
import type { MarketplacePlugin } from '../../../domain/entities/MarketplacePlugin';
import type { InstalledExtension } from '../../../domain/entities/InstalledExtension';
import type { TenantExtension } from '../../../domain/entities/TenantExtension';
import type { PublicExtension } from '../../../domain/entities/PublicExtension';
import type { WidgetSpec } from '../../../domain/schema/ui/widgetSpec';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';

import { useT, useLocaleFormat } from '../../shared/i18n/useT';
import { usePackageCatalog } from '../../shared/i18n/usePackageCatalog';
import { resolveLabel } from '../../../domain/schema/i18n/messageRef';
import { packageMessageCatalog } from '../../../domain/schema/i18n/extensionPoints';
import { catalogWithFallback } from '../../../domain/schema/i18n/messages';
import type { MessageCatalog, MessageParams } from '../../../domain/schema/i18n/messages';

export interface Author {
  name: string | null;
  photoURL: string | null;
}

/** A nota pública de uma extensão, pronta para desenhar. */
export interface RatingSummary {
  stars: StarKind[];
  /** A média com uma casa, no formato de quem lê. */
  average: string;
  /** Quantos votaram, no formato curto ("1,2 mil"). */
  count: string;
  /** A frase inteira, para o `title` — a média e quantos votaram. */
  label: string;
}

/** Uma estrela do voto de quem está lendo: a posição e se está acesa. */
export interface RatingStar {
  value: number;
  filled: boolean;
  label: string;
}

export type StatusBadge = 'published' | 'pending' | 'deprecated' | 'private' | 'builtin' | 'system';
export type InstallBadge = 'active' | 'inactive';
export type InstallAction = 'install' | 'update';

/**
 * O que há para levar ao catálogo global a partir da cópia PRIVADA desta extensão.
 *
 * `needs-version` é o caso que não pode ser silencioso: o pacote privado mudou, mas a versão dele não
 * subiu — e quem já instalou a extensão só recebe a cópia nova quando a versão sobe. Sem este estado
 * a tela ou publicaria um pacote que ninguém receberia, ou faria o botão sumir sem dizer por quê.
 */
export type PublishAction = 'publish' | 'republish' | 'needs-version';

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
  /**
   * Traz a fonte das próprias Cloud Functions. Selo à parte de "com código" porque o alcance é outro:
   * a view roda no navegador de quem a abre; isto roda no servidor, com acesso a todo escritório do
   * projeto, e só sobe depois que quem opera o projeto aprova.
   */
  hasServerCode: boolean;
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

  /** A imagem declarada (`manifest.image`), quando é uma que a tela desenha. */
  image: string | null;
  /** O ícone do catálogo que identifica a extensão quando não há imagem. Ver `extensionGlyphOf`. */
  glyph: string | null;
  /** Quem responde pela autenticidade do publicador, ou `null`. Ver `publisherVerificationOf`. */
  verification: PublisherVerification | null;
  /** O que o selo de verificação significa, já traduzido — vai no `title` dele. */
  verificationLabel: string | null;
  /** Quantos escritórios instalaram, no formato curto. Nulo enquanto não há contagem. */
  installs: string | null;
  /** A mesma contagem por extenso, para o `title`. */
  installsLabel: string | null;
  /** A nota pública, ou `null` sem voto nenhum — zero estrelas não é nota. */
  rating: RatingSummary | null;
  /** Quem lê pode votar: a extensão está instalada aqui, a partir do catálogo. */
  canRate: boolean;
  /** O SYSTEM pode conceder ou retirar o selo do escritório que publicou. */
  canVerifyPublisher: boolean;
  publisherVerified: boolean;

  installBadge: InstallBadge | null;
  statusBadge: StatusBadge | null;
  updateAvailable: boolean;

  canEdit: boolean;
  install: InstallAction | null;
  active: boolean;
  canToggleActive: boolean;
  published: boolean;
  /**
   * O gesto de publicação disponível, ou `null` quando não há nenhum: extensão que não é de autoria
   * deste escritório, que traz código sem que quem olha seja SYSTEM, ou que já está no catálogo
   * exatamente como está aqui. Publicada e idêntica não oferece nada — não havia o que republicar, e
   * o botão que insistia em aparecer era a própria pergunta "republicar o quê?".
   */
  publish: PublishAction | null;
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
   * A chave da explicação da pendência e as functions que ela cita. Sem motivo gravado pelo Console,
   * é a instrução genérica: rodar o `provision`. Com motivo, é ele — dizer "rode o comando" a quem já
   * rodou foi o que tornou o defeito da extensão de e-mail num diagnóstico de horas.
   */
  backendPendingDetail: { key: string; functions: string };
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
  codeTrustedByName: string | null;

  mine: boolean;
  /**
   * Está em "Minhas" porque foi IMPORTADA, e não montada aqui. A fonte dela é de quem a escreveu: aqui
   * ela é ativada, instalada e publicada, mas não editada nem baixada.
   */
  imported: boolean;
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
  /**
   * Por que esta extensão pede atenção — a MESMA resposta do selo do menu (`useExtensionPendencies`).
   * Não ser vazio é o que a põe na aba "Pendentes".
   */
  pendencies: readonly ExtensionPendency[];
}

export interface ExtensionProblem {
  severity: string;
  message: string;
}

/**
 * `pending` é o recorte do selo do menu: as instaladas e ligadas que devem algum gesto. Ele vive ao
 * lado de "Instaladas" porque é um subconjunto dela, e é por ele que a tela abre quando há pendência.
 */
export type MarketplaceFilter = 'all' | 'installed' | 'pending' | 'mine' | 'catalog';

/**
 * A ordem da lista. `relevance` é a de sempre — instaladas, depois as do escritório, depois o resto —
 * e continua sendo o padrão: quem abre a tela para gerenciar o que tem não pode ter a ordem trocada
 * por popularidade.
 */
export type MarketplaceSort = 'relevance' | 'installs' | 'rating' | 'name';

/** Onde a extensão importada fica disponível: só neste escritório, ou no catálogo de todos. */
export type ImportScope = 'private' | 'public';

/**
 * O arquivo já lido e reconhecido como pacote, à espera da decisão de alcance. Ele é lido ANTES de
 * qualquer escrita para que a pergunta possa dizer de quem é o pacote e o que ele traz — perguntar
 * "onde isto fica disponível?" sobre um arquivo anônimo não é uma escolha informada.
 */
export interface ImportTarget {
  text: string;
  name: string;
  version: string;
  hasCode: boolean;
  /** O catálogo global está aberto para ESTE pacote nas mãos de quem importa. */
  canPublish: boolean;
  /**
   * A versão que já está instalada neste escritório, ou `null`. Muda o que "instalar" quer dizer:
   * com cópia instalada, o gesto é atualizá-la para o pacote importado.
   */
  installedVersion: string | null;
}

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
  sort: MarketplaceSort;
  /** Recebe o valor do seletor; o que não for uma ordem conhecida é ignorado. */
  setSort: (sort: string) => void;
  sortOptions: SearchSelectOption[];
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
  /**
   * A troca que deixaria uma extensão fora da faixa de versão que outra declara, esperando o
   * consentimento: a frase inteira, com cada extensão que sai do ar. `null` quando não há o que perguntar.
   */
  rangeConfirmMessage: string | null;
  confirmRange: () => Promise<void>;
  cancelRange: () => void;
  /**
   * A extensão que pede confiança para executar código. A pergunta é sobre QUEM a escreveu — autor e
   * selo de verificação —, não sobre a leitura da fonte, que um admin de escritório não tem como avaliar.
   */
  reviewTarget: ExtensionRow | null;
  detailsRow: ExtensionRow | null;
  /**
   * As cinco estrelas do voto de quem lê, na extensão do modal de detalhes. Vazio quando não pode
   * votar nela.
   */
  myRatingStars: RatingStar[];
  /** Já votou — é o que oferece retirar o voto. */
  hasMyRating: boolean;
  rate: (stars: number) => Promise<void>;
  clearMyRating: () => Promise<void>;
  /** Concede ou retira o selo do publicador desta extensão. */
  togglePublisherVerified: (id: string) => Promise<void>;
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
  /** O arquivo escolhido, esperando a decisão de onde a extensão vai ficar disponível. */
  importTarget: ImportTarget | null;
  importScope: ImportScope;
  setImportScope: (scope: ImportScope) => void;
  /**
   * Instalar (ou atualizar a cópia instalada) logo depois de importar. Marcado por padrão: importar e
   * esquecer de instalar era o caminho comum, e a extensão ficava em "Minhas" sem estar no ar.
   */
  importInstall: boolean;
  setImportInstall: (install: boolean) => void;
  confirmImport: () => Promise<void>;
  cancelImport: () => void;
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

/** `Record` e não `switch`: um motivo novo no contrato sem mensagem aqui é erro de tipo, não tela muda. */
const BACKEND_PENDING_DETAIL: Record<BackendPendingReason, string> = {
  'function-source-missing': 'extension.backend-pending.reason.function-source-missing',
  'function-claim-refused': 'extension.backend-pending.reason.function-claim-refused',
  'gate-missing': 'extension.backend-pending.reason.gate-missing',
  'deploy-failed': 'extension.backend-pending.reason.deploy-failed',
  'awaiting-approval': 'extension.backend-pending.reason.awaiting-approval',
  'source-invalid': 'extension.backend-pending.reason.source-invalid',
};

const backendPendingDetailOf = (cause: ExtensionBackendPending | null): { key: string; functions: string } =>
  cause === null
    ? { key: 'extension.backend-pending.detail', functions: '' }
    : { key: BACKEND_PENDING_DETAIL[cause.reason], functions: cause.functions.join(', ') };

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
      case 'verified': return matchesBoolean(values, row.verification !== null);
      case 'category': return row.categoryLabel === null
        ? values.includes(UNCATEGORIZED)
        : values.map(categoryLabelOf).includes(row.categoryLabel);
      case 'update': return matchesBoolean(values, row.updateAvailable);
      case 'installation': return matchesBoolean(values, row.installed);
      default: return true;
    }
  });

/** A aplicação recusada por faixa, guardando o gesto que a repete já com o consentimento. */
interface PendingRangeConfirm {
  id: string;
  issues: readonly LocalizedIssue[];
  retry: () => Promise<void>;
  successMessage: string;
}

const rankOf = (row: ExtensionRow): number => (row.installed ? 0 : row.mine ? 1 : 2);

const SORTS: MarketplaceSort[] = ['relevance', 'installs', 'rating', 'name'];

const isSort = (value: string): value is MarketplaceSort => (SORTS as string[]).includes(value);

const byName = (a: ExtensionRow, b: ExtensionRow): number => a.name.localeCompare(b.name);

export const useMarketplaceViewModel = (): MarketplaceViewModel => {
  const t = useT('core.marketplace');
  const { formatDateTime, formatNumber } = useLocaleFormat();
  const { extensions, importExtension, removeExtension } = useTenantExtensions();
  const { currentTenant } = useTenant();
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
  const {
    publicExtensions,
    publish: publishPublic,
    approve: approvePublic,
    deprecate: deprecatePublic,
    unpublish,
    publicOf,
    statsById,
    verifiedPublishers,
    myRatingOf,
    rate: ratePublic,
    clearRating,
    setPublisherVerified,
  } = usePublicExtensions();
  const { can } = useAuthorization();
  const { user, userRole } = useAuth();
  const { notify } = useNotification();
  const { openTab } = useWorkspace();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [rangeConfirm, setRangeConfirm] = useState<PendingRangeConfirm | null>(null);
  const [filter, setFilter] = useState<MarketplaceFilter>('all');
  const [sort, setSortState] = useState<MarketplaceSort>('relevance');
  const setSort = useCallback((value: string) => { if (isSort(value)) setSortState(value); }, []);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [licenseId, setLicenseId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [importTarget, setImportTarget] = useState<ImportTarget | null>(null);
  const [importScope, setImportScope] = useState<ImportScope>('private');
  const [importInstall, setImportInstall] = useState(true);

  const {
    ready: pendenciesReady,
    updateIds: pendingUpdateIds,
    pendenciesOf,
    pendingCount,
  } = useExtensionPendencies();
  const [entryFilterDecided, setEntryFilterDecided] = useState(false);

  /**
   * Entrar JÁ na aba "Pendentes" quando há alguma pendência — e na lista inteira quando não há. É o
   * gesto que o selo promete: quem clica no selo vem resolver o que ele contou, e chegar na lista
   * inteira obrigaria a refazer à mão o recorte que o selo acabou de anunciar.
   *
   * A decisão é de ENTRADA e acontece UMA vez, quando as origens terminam de carregar: antes disso a
   * contagem é zero por não se saber ainda, e depois disso a aba é de quem está olhando — resolver a
   * última pendência não pode tirar a pessoa da aba em que ela está.
   */
  useEffect(() => {
    if (entryFilterDecided || !pendenciesReady) return;
    /* eslint-disable react-hooks/set-state-in-effect -- a decisão de entrada só pode ser tomada quando as origens carregam, e é o carregamento que a dispara */
    setEntryFilterDecided(true);
    if (pendingCount > 0) setFilter('pending');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [entryFilterDecided, pendenciesReady, pendingCount]);

  const { trustedIds } = useInstalledCodeTrust();

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

  /**
   * `retry` é o mesmo gesto já com o consentimento de faixa. Quem o passa aceita que a recusa de
   * faixa vire PERGUNTA em vez de erro; quem não passa continua recebendo a recusa como sempre.
   */
  const run = useCallback(
    async (id: string, action: () => Promise<void>, successMessage: string, retry?: () => Promise<void>) => {
      setBusyId(id);
      try {
        await action();
        notify(successMessage, 'success');
      } catch (err) {
        if (retry && err instanceof DependencyRangeRefusal) {
          setRangeConfirm({ id, issues: err.issues, retry, successMessage });
          return;
        }
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

  /**
   * O que a cópia privada tem a levar ao catálogo. Reusa a MESMA recusa que o store aplica ao
   * publicar: um botão oferecido aqui e recusado lá seria a tela mentindo sobre o que sabe.
   */
  const publishActionOf = useCallback(
    (priv: TenantExtension | undefined, pub: PublicExtension | undefined): PublishAction | null => {
      if (!priv || !currentTenant) return null;
      const refusal = publishRefusal({
        pkg: priv.package,
        isSystem: canModerate,
        ownerTenantId: currentTenant.id,
        published: pub,
      });
      if (refusal === null) return pub ? 'republish' : 'publish';
      // Versão não maior só é um AVISO quando há mesmo o que levar: publicada e idêntica não pede
      // versão nova, pede silêncio. Só esta recusa sobrevive à checagem — ela é a única que o autor
      // resolve daqui, subindo a versão do próprio pacote.
      if (refusal !== 'version-not-greater' || !pub) return null;
      return packageFingerprint(priv.package) === packageFingerprint(pub.package) ? null : 'needs-version';
    },
    [currentTenant, canModerate],
  );

  /**
   * Instalações e nota de uma extensão, como a linha as mostra. O número curto ("1,2 mil") é o que
   * cabe na linha; a frase por extenso vai no `title`, para quem quer o número exato.
   */
  const reputationOf = useCallback((id: string) => {
    const stats = statsById.get(id);
    const compact = (value: number) => formatNumber(value, { notation: 'compact', maximumFractionDigits: 1 });
    const average = ratingAverage(stats);
    return {
      installs: stats ? compact(stats.installs) : null,
      installsLabel: stats
        ? t('extension.installs', { count: stats.installs, formatted: formatNumber(stats.installs) })
        : null,
      rating: stats && average !== null
        ? {
          stars: starsOf(average),
          average: formatNumber(average, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
          count: compact(stats.ratingCount),
          label: t('extension.rating', {
            count: stats.ratingCount,
            formatted: formatNumber(stats.ratingCount),
            average: formatNumber(average, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
            max: MAX_STARS,
          }),
        }
        : null,
    };
  }, [statsById, formatNumber, t]);

  const verificationLabelOf = useCallback((verification: PublisherVerification | null): string | null => {
    if (verification === 'first-party') return t('extension.verified.first-party');
    if (verification === 'verified') return t('extension.verified.publisher');
    return null;
  }, [t]);

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
        hasServerCode: false,
        overview: pkg.overview ?? null,
        license: licenseOf(pkg.manifest),
        description: label(pkg.manifest.description ?? ''),
        category: pkg.manifest.category ?? null,
        categoryLabel: pkg.manifest.category ? label(pkg.manifest.category) : null,
        image: extensionImageOf(pkg),
        glyph: extensionGlyphOf(pkg),
        verification: 'first-party',
        verificationLabel: verificationLabelOf('first-party'),
        installs: null,
        installsLabel: null,
        rating: null,
        canRate: false,
        canVerifyPublisher: false,
        publisherVerified: false,
        installBadge: 'active',
        statusBadge: 'system',
        updateAvailable: false,
        canEdit: false,
        install: null,
        active: true,
        canToggleActive: false,
        published: false,
        publish: null,
        canDownload: true,
        canUninstall: false,
        canDelete: false,
        canApprove: false,
        canDeprecate: false,
        needsCodeReview: false,
        backendPending: false,
        backendPendingDetail: backendPendingDetailOf(null),
        migrationPending: false,
        migrationError: null,
        canRunMigrations: false,
        hasHistory: false,
        codeTrustedByName: null,
        mine: false,
        imported: false,
        installed: true,
        isPublic: false,
        isBuiltin: false,
        isSystem: true,
        problems: problemsByPlugin.get(id) ?? [],
        failed: false,
        pendencies: [],
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

      // A cópia do bundle é de primeira parte; a mesma identidade vinda de outra origem — importada,
      // publicada por um escritório — responde pela origem dela, e não pelo nome que carrega.
      const firstParty = builtin !== null && !priv && (!inst || inst.source === 'builtin');
      const verification = publisherVerificationOf({
        firstParty,
        ownerTenantId: pub?.ownerTenantId ?? null,
        verifiedPublishers,
      });
      const reputation = reputationOf(id);

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
        hasServerCode: extensionHasServerCode(pkg),
        overview: pkg.overview ?? null,
        license: licenseOf(pkg.manifest),
        description: label(pkg.manifest.description ?? ''),
        category: pkg.manifest.category ?? null,
        categoryLabel: pkg.manifest.category ? label(pkg.manifest.category) : null,
        image: extensionImageOf(pkg),
        glyph: extensionGlyphOf(pkg),
        verification,
        verificationLabel: verificationLabelOf(verification),
        ...reputation,
        canRate: Boolean(inst) && inst?.source !== 'private' && user !== null,
        canVerifyPublisher: canModerate && Boolean(pub),
        publisherVerified: pub ? verifiedPublishers.has(pub.ownerTenantId) : false,
        installBadge: inst ? (inst.active ? 'active' : 'inactive') : null,
        statusBadge,
        updateAvailable,
        canEdit: isAuthoredHere(priv),
        install,
        active: inst?.active ?? false,
        canToggleActive: installed_,
        published: publicStatus !== null,
        publish: publishActionOf(priv, pub),
        // Baixa quem tem a FONTE: o que foi montado aqui, e o embutido — que é nosso, e é o pacote que
        // o `npm run build:extensions` gera para levar a extensão a um escritório que não roda este
        // bundle. A importada e a cópia instalada vinda do catálogo não: a fonte delas é de outro.
        canDownload: isAuthoredHere(priv) || !!builtin,
        canUninstall: installed_,
        canDelete: mine,
        canApprove: canModerate && publicStatus === 'pending',
        canDeprecate: canModerate && publicStatus === 'approved',
        backendPending: inst !== undefined && inst !== null && isExtensionBackendPending(inst),
        backendPendingDetail: backendPendingDetailOf(inst ? extensionBackendPendingCause(inst) : null),
        migrationPending: inst ? isExtensionMigrationPending(inst, migrationStates) : false,
        migrationError: migrationErrorOf(inst),
        canRunMigrations: canManage && inst !== undefined && pendingMigrationsOf(id).length > 0,
        hasHistory: canManage && (histories.get(id)?.entries.length ?? 0) > 0,
        needsCodeReview: Boolean(inst) && installedNeedsReview.has(id),
        codeTrustedByName: inst?.codeTrust?.trustedByName ?? null,
        mine,
        imported: priv?.origin === 'imported',
        installed: installed_,
        isPublic: isApproved,
        isBuiltin: !!builtin,
        isSystem: false,
        problems,
        failed: problems.some((problem) => problem.severity === 'error'),
        pendencies: pendenciesOf(id),
      });
    }

    return list.sort((a, b) => rankOf(a) - rankOf(b) || a.name.localeCompare(b.name));
  }, [extensions, installed, publicExtensions, publicOf, pendingUpdateIds, pendenciesOf, canModerate, canManage, user, installedNeedsReview, problemsByPlugin, label, migrationStates, pendingMigrationsOf, migrationErrorOf, histories, publishActionOf, verifiedPublishers, reputationOf, verificationLabelOf]);

  const counts = useMemo<Record<MarketplaceFilter, number>>(() => ({
    all: rows.length,
    installed: rows.filter((r) => r.installed).length,
    pending: rows.filter((r) => r.pendencies.length > 0).length,
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
    { key: 'verified', label: t('extension.verified.publisher'), type: 'select', options: booleanOptions },
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

  const sortOptions = useMemo<SearchSelectOption[]>(
    () => SORTS.map((value) => ({ value, label: t(`sort.${value}`) })),
    [t],
  );

  const visibleRows = useMemo<ExtensionRow[]>(() => {
    const filtered = (() => {
      switch (filter) {
        case 'installed': return rows.filter((r) => r.installed);
        case 'pending': return rows.filter((r) => r.pendencies.length > 0);
        case 'mine': return rows.filter((r) => r.mine);
        case 'catalog': return rows.filter((r) => r.isPublic);
        default: return rows.filter((r) => matchesTokens(r, filterTokens, label));
      }
    })();
    switch (sort) {
      case 'installs': return [...filtered].sort(compareByMetric((row: ExtensionRow) => statsById.get(row.id)?.installs ?? null, byName));
      case 'rating': return [...filtered].sort(compareByMetric((row: ExtensionRow) => ratingAverage(statsById.get(row.id)), byName));
      case 'name': return [...filtered].sort(byName);
      default: return filtered;
    }
  }, [rows, filter, filterTokens, label, sort, statsById]);

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
    if (priv && isAuthoredHere(priv)) { downloadPackage(id, serializePackage(priv.package)); return; }
    const builtin = BUILTIN_BY_ID.get(id);
    if (builtin) downloadPackage(id, serializePackage(builtin));
  }, [extensions, downloadPackage]);

  /**
   * Leva ao catálogo global o pacote que já está no escritório. A recusa vem do store como REFERÊNCIA
   * de mensagem com os valores que ela interpola — e é por isso que o `label` recebe os dois: a de
   * versão não maior só ensina o que fazer se disser qual versão está publicada.
   */
  const publishPackage = useCallback(async (id: string, pkg: MarketplacePlugin) => {
    setBusyId(id);
    try {
      const result = await publishPublic(pkg);
      if (!result.ok) notify(t('extension.publish-failed', { detail: label(result.error, result.errorParams) }), 'error');
      else notify(t('extension.published'), 'success');
    } catch (err) {
      notify(t('extension.publish-failed', wrappedErrorParams(err)), 'error');
    } finally {
      setBusyId(null);
    }
  }, [publishPublic, notify, t, label]);

  const publish = useCallback(async (id: string) => {
    const ext = extensions.find((e) => e.id === id);
    if (!ext) return;
    await publishPackage(id, ext.package);
  }, [extensions, publishPackage]);

  const install = useCallback((id: string) => {
    const inst = installed.find((e) => e.id === id);
    if (inst) {
      const input = updateSourceOf(id, inst.installedVersion) ?? builtinUpdateOf(id, inst);
      if (!input) return Promise.resolve();
      return run(
        id,
        () => installCopy(input),
        t('extension.updated'),
        () => installCopy(input, { acceptDependencyRanges: true }),
      );
    }
    const input = privateInputOf(id) ?? publicInputOf(id) ?? builtinInputOf(id);
    if (!input) return Promise.resolve();
    return run(
      id,
      () => installCopy(input),
      t('extension.installed'),
      () => installCopy(input, { acceptDependencyRanges: true }),
    );
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

  const rangeConfirmMessage = useMemo(
    () => (rangeConfirm === null
      ? null
      : t('extension.range.message', {
        detail: rangeConfirm.issues.map((issue) => label(issue.message, issue.messageParams)).join(' '),
      })),
    [rangeConfirm, t, label],
  );

  const confirmRange = useCallback(async () => {
    if (!rangeConfirm) return;
    const { id, retry, successMessage } = rangeConfirm;
    setRangeConfirm(null);
    await run(id, retry, successMessage);
  }, [rangeConfirm, run]);

  const cancelRange = useCallback(() => setRangeConfirm(null), []);

  const openReview = useCallback((id: string) => {
    if (installed.some((candidate) => candidate.id === id)) setReviewId(id);
  }, [installed]);

  const cancelReview = useCallback(() => setReviewId(null), []);

  const openDetails = useCallback((id: string) => setDetailsId(id), []);
  const closeDetails = useCallback(() => setDetailsId(null), []);

  const detailsRow = useMemo(
    () => rows.find((row) => row.id === detailsId) ?? null,
    [rows, detailsId],
  );

  /**
   * O voto de quem lê é buscado quando o modal abre — e só ali: perguntar por todas as linhas da
   * lista custaria uma leitura por extensão para mostrar algo que só o modal desenha. O valor vem
   * marcado com a extensão a que pertence, para que a resposta atrasada de um modal já fechado não
   * apareça no próximo.
   */
  const [myRating, setMyRating] = useState<{ id: string; stars: number | null } | null>(null);
  const ratingTargetId = detailsRow?.canRate ? detailsRow.id : null;

  useEffect(() => {
    if (ratingTargetId === null) return undefined;
    let cancelled = false;
    void myRatingOf(ratingTargetId).then(
      (stars) => { if (!cancelled) setMyRating({ id: ratingTargetId, stars }); },
      (err: unknown) => { console.error('[marketplace] read rating failed:', err); },
    );
    return () => { cancelled = true; };
  }, [ratingTargetId, myRatingOf]);

  const myStars = myRating !== null && myRating.id === ratingTargetId ? myRating.stars : null;

  const myRatingStars = useMemo<RatingStar[]>(
    () => (ratingTargetId === null
      ? []
      : Array.from({ length: MAX_STARS }, (_, index) => ({
        value: index + 1,
        filled: myStars !== null && index < myStars,
        label: t('extension.rate.star', { count: index + 1 }),
      }))),
    [ratingTargetId, myStars, t],
  );

  const rate = useCallback(async (stars: number) => {
    if (ratingTargetId === null) return;
    const id = ratingTargetId;
    const previous = myStars;
    setMyRating({ id, stars });
    try {
      await ratePublic(id, stars);
      notify(t('extension.rated'), 'success');
    } catch (err) {
      setMyRating({ id, stars: previous });
      notify(t('extension.operation-failed', wrappedErrorParams(err)), 'error');
    }
  }, [ratingTargetId, myStars, ratePublic, notify, t]);

  const clearMyRating = useCallback(async () => {
    if (ratingTargetId === null) return;
    const id = ratingTargetId;
    const previous = myStars;
    setMyRating({ id, stars: null });
    try {
      await clearRating(id);
      notify(t('extension.rating.cleared'), 'success');
    } catch (err) {
      setMyRating({ id, stars: previous });
      notify(t('extension.operation-failed', wrappedErrorParams(err)), 'error');
    }
  }, [ratingTargetId, myStars, clearRating, notify, t]);

  const togglePublisherVerified = useCallback((id: string) => {
    const pub = publicOf(id);
    if (!pub) return Promise.resolve();
    const verified = !verifiedPublishers.has(pub.ownerTenantId);
    return run(
      id,
      () => setPublisherVerified(pub.ownerTenantId, verified),
      t(verified ? 'extension.publisher-verified' : 'extension.publisher-unverified', { name: pub.ownerName }),
    );
  }, [publicOf, verifiedPublishers, run, setPublisherVerified, t]);

  const openLicense = useCallback((id: string) => setLicenseId(id), []);
  const closeLicense = useCallback(() => setLicenseId(null), []);

  const licenseRow = useMemo(
    () => rows.find((row) => row.id === licenseId) ?? null,
    [rows, licenseId],
  );

  const reviewTarget = useMemo(
    () => rows.find((row) => row.id === reviewId) ?? null,
    [rows, reviewId],
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
      return run(
        id,
        () => restoreVersion(id, revision),
        t('history.applied', { version: entry?.version ?? '' }),
        () => restoreVersion(id, revision, { acceptDependencyRanges: true }),
      );
    },
    [histories, run, restoreVersion, t],
  );

  const confirmReview = useCallback(async () => {
    if (!reviewTarget) return;
    const { id } = reviewTarget;
    setReviewId(null);
    await run(id, () => trustCode(id), t('extension.trusted'));
  }, [reviewTarget, run, trustCode, t]);

  const confirmRemove = useCallback(async () => {
    if (!removeTarget) return;
    const { id } = removeTarget;
    setRemoveTarget(null);
    await run(id, () => removeExtension(id), t('extension.removed'));
  }, [removeTarget, run, removeExtension, t]);

  /**
   * Escolher o arquivo não importa nada: abre a PERGUNTA de alcance. O pacote é lido aqui só para que
   * ela possa ser feita sobre algo — nome, versão e se traz código, que é o que decide se o catálogo
   * global está aberto para ele. Arquivo que nem é pacote é recusado antes da pergunta: não há o que
   * perguntar sobre um arquivo que não vai entrar de jeito nenhum.
   */
  const onImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusyId('__import__');
    try {
      const text = await file.text();
      const parsed = parsePackage(text);
      if (!parsed.ok) {
        notify(t('extension.import-failed', { detail: label(parsed.error) }), 'error');
        return;
      }
      const hasCode = hasCodeOf(parsed.package.views);
      const { manifest } = parsed.package;
      // O pacote escolhido ainda não está em lista nenhuma, então o catálogo da tela não tem o texto
      // dele: o nome aparecia como a chave crua (`br.com.acme.sales/extension.name`). Ele é lido do
      // próprio pacote, por baixo do catálogo do escritório — a mesma precedência de `usePackageCatalog`.
      const ownCatalog = catalogWithFallback(catalog, packageMessageCatalog(manifest.contributes ?? [], catalog.locale));
      setImportScope('private');
      setImportInstall(true);
      setImportTarget({
        text,
        name: resolveLabel(ownCatalog, manifest.name) || manifest.id,
        version: manifest.version,
        hasCode,
        // A regra de publicar é a das Rules (`pkgHasCode`), que conta também a fonte de servidor —
        // oferecer o catálogo a quem ele recusaria seria pedir um gesto que falha.
        canPublish: canPublishPublicly(parsed.package, canModerate),
        installedVersion: installed.find((extension) => extension.id === manifest.id)?.installedVersion ?? null,
      });
    } catch (err) {
      notify(t('extension.import-failed', wrappedErrorParams(err)), 'error');
    } finally {
      setBusyId(null);
    }
  }, [notify, t, label, canModerate, catalog, installed]);

  const cancelImport = useCallback(() => setImportTarget(null), []);

  /**
   * A cópia instalada a partir do pacote que ACABOU de ser importado. Não sai de `privateInputOf`
   * porque a lista de "Minhas" ainda não recebeu a gravação neste render; a autoria é a mesma que a
   * importação grava — a de quem importou primeiro, ou a de quem importa agora.
   */
  const importedInputOf = useCallback((pkg: MarketplacePlugin): InstallExtensionInput => {
    const previous = extensions.find((extension) => extension.id === pkg.manifest.id);
    return {
      package: pkg,
      source: 'private',
      version: pkg.manifest.version,
      authorId: previous?.createdBy ?? user?.id ?? '',
      authorName: previous?.createdByName ?? user?.displayName ?? '',
      authorPhotoURL: previous?.createdByPhotoURL ?? user?.photoURL ?? null,
    };
  }, [extensions, user]);

  /**
   * Importar é sempre a mesma escrita — a cópia privada do escritório. Instalar e "disponível para
   * todos" vêm DEPOIS dela, nessa ordem e de propósito: os dois partem de um pacote que já foi
   * validado e gravado aqui, e um passo seguinte que falhe deixa a extensão importada em vez de deixar
   * o gesto inteiro no vazio. Instalar vai antes de publicar porque é o que o escritório veio fazer;
   * publicar é para os outros.
   *
   * Instalar passa pelo MESMO `run` dos botões da linha, com a mesma pergunta de faixa de versão: a
   * caixa marcada é um atalho para o botão "Instalar", não uma porta com outras regras.
   */
  const confirmImport = useCallback(async () => {
    const target = importTarget;
    if (!target) return;
    setImportTarget(null);
    setBusyId('__import__');
    let imported: { id: string; package: MarketplacePlugin } | null = null;
    try {
      const result = await importExtension(target.text);
      if (!result.ok) {
        notify(t('extension.import-failed', { detail: label(result.error, result.errorParams) }), 'error');
        return;
      }
      notify(t('extension.imported', { name: target.name }), 'success');
      imported = { id: result.package.manifest.id, package: result.package };
    } catch (err) {
      notify(t('extension.import-failed', wrappedErrorParams(err)), 'error');
    } finally {
      setBusyId(null);
    }
    if (!imported) return;
    if (importInstall) {
      const current = installed.find((extension) => extension.id === imported.id);
      // Reimportar o MESMO pacote que já está no ar não tem o que aplicar: reinstalá-lo só
      // reconvergiria os artefatos para o estado em que eles já estão.
      const unchanged = current !== undefined
        && packageFingerprint(current.package) === packageFingerprint(imported.package);
      if (!unchanged) {
        const input = importedInputOf(imported.package);
        await run(
          imported.id,
          () => installCopy(input),
          t(current ? 'extension.updated' : 'extension.installed'),
          () => installCopy(input, { acceptDependencyRanges: true }),
        );
      }
    }
    if (importScope === 'public') await publishPackage(imported.id, imported.package);
  }, [importTarget, importScope, importInstall, importExtension, importedInputOf, installed, installCopy, run, publishPackage, notify, t, label]);

  return {
    canManage,
    residue,
    canModerate,
    catalog,
    rows: visibleRows,
    filter,
    setFilter,
    sort,
    setSort,
    sortOptions,
    counts,
    filterDefs,
    filterTokens,
    setFilterTokens,
    savedFiltersScreenKey: 'marketplace',
    busyId,
    removeTarget,
    reviewTarget,
    detailsRow,
    myRatingStars,
    hasMyRating: myStars !== null,
    rate,
    clearMyRating,
    togglePublisherVerified,
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
    importTarget,
    importScope,
    setImportScope,
    importInstall,
    setImportInstall,
    confirmImport,
    cancelImport,
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
    rangeConfirmMessage,
    confirmRange,
    cancelRange,
    approve,
    reject,
    deprecate,
  };
};
