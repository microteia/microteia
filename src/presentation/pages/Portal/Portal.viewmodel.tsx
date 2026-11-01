import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../stores/useAuth';
import { usePortal } from '../../../stores/usePortal';
import { usePortalNavigation } from '../../../stores/usePortalNavigation';
import { useLocaleFormat, useT } from '../../shared/i18n/useT';
import { canEditPortalRecord, fillPortalWelcome, portalWelcomeValues, type PortalDocument, type PortalScreenInfo } from '../../../domain/entities/Portal';
import { portalSubjectKey } from '../../../domain/schema/portal';
import { portalTemplatePlaces } from '../../../domain/schema/ui/portalTemplate';
import { portalTenantPath } from './portalPaths';
import { usePortalRecordFormat } from './usePortalRecordFormat';
import { usePortalWidget } from './usePortalWidget';
import { evaluatePortalView, type PortalViewComponent } from './portalViews';
import { portalAccessError, portalOffersSignInAgain, type PortalAccessError } from './portalAccessError';
import {
  portalCardArrangement,
  resolvePortalNodes,
  type PortalCardArrangement,
  type ResolvedPortalNode,
} from './resolvePortalTemplate';

export interface PortalFieldView {
  key: string;
  label: string;
  value: string;
  /** Presente quando o valor é um arquivo — o campo exposto é o link dele. */
  href: string | null;
  /** A cor da opção escolhida num `select`, já resolvida pelo tema. */
  color: string | null;
}

export interface PortalRecordCard {
  collection: string;
  id: string;
  title: string;
  summary: string;
  updatedAt: string;
  /** O cartão desenhado pela tela (`portal.template.card`); `null` quando ela não o declara. */
  nodes: ResolvedPortalNode[] | null;
  /** A faixa do topo: a cor da opção escolhida no campo de `accent`. */
  accentColor: string | null;
}


export interface PortalDocumentView {
  id: string;
  name: string;
  meta: string;
  /** `SHA-256 <hash>`, já resolvido. Vazio enquanto o servidor não o calculou. */
  hash: string;
}

/** A casca de uma extensão: recebe a página como `children`. */
export type PortalLayoutComponent = React.ComponentType<{ children: React.ReactNode }>;

/**
 * Um cartão da home, com o título que a extensão declarou: a view dela (`Component`), ou o widget
 * declarado já respondido (`nodes`).
 */
export interface PortalWidgetItem {
  id: string;
  title: string;
  Component: PortalViewComponent | null;
  nodes: ResolvedPortalNode[] | null;
  /** O widget declarado lê uma tela que ainda não chegou. */
  loading: boolean;
}


/**
 * Uma tela-filha dentro do registro aberto: as notas do prestador. Não carrega os registros — quem
 * os pede ao servidor, só os deste pai e com limite, é a aba (`PortalChildList`).
 */
export interface PortalChildSection {
  collection: string;
  title: string;
  screen: PortalScreenInfo;
  /** O pai, como a projeção o grava (`colecao/id`). */
  parentKey: string;
  /** O rótulo do botão "+", já com o nome da tela. */
  createLabel: string | null;
}

/** Uma aba do registro aberto: um filho, ou os documentos. */
export interface PortalRecordTab {
  key: string;
  label: string;
}

/** A aba dos documentos — a chave não colide com coleção nenhuma. */
export const PORTAL_DOCUMENTS_TAB = '#documents';

export interface PortalViewModel {
  loading: boolean;
  error: PortalAccessError | null;
  /** A recusa se resolve entrando de novo — a casca oferece o botão. */
  signInAgain: boolean;
  /** O código técnico de uma falha — o que a pessoa repassa a quem a atende. */
  errorCode: string | null;
  /** Há o que tentar de novo: a falha não foi uma recusa. */
  canRetry: boolean;
  retry: () => void;
  /** Com que conta a pessoa entrou — o "sem acesso" mais comum é estar na conta errada. */
  signedInAs: string;
  showChooser: boolean;
  memberships: Array<{ tenantId: string; tenantName: string }>;
  chooseTenant: (tenantId: string) => void;
  /**
   * A CASCA escolhida pelo escritório: a de uma extensão (`portal.view` de superfície `layout`), ou
   * `null` para um dos layouts do kernel — `sidebar` ou `top`, em `builtinLayout`. O menu, a marca e o
   * usuário moram nela (`usePortalShell`), e não aqui: aqui fica só o conteúdo da página.
   */
  Layout: PortalLayoutComponent | null;
  builtinLayout: 'sidebar' | 'top';
  atHome: boolean;
  goHome: () => void;
  home: {
    title: string;
    /** As boas-vindas do escritório — dado dele, sem tradução, com os marcadores já preenchidos. */
    welcome: string;
    widgets: PortalWidgetItem[];
    /** A home inteira de uma extensão, quando há uma. */
    Component: PortalViewComponent | null;
  };
  /** A página de extensão aberta pelo menu. */
  pageView: PortalViewComponent | null;
  /**
   * A página DECLARADA aberta pelo menu (`portalPageSpec`), já respondida sobre o que o convidado tem: o
   * texto e os dados vêm prontos do servidor, e aqui só se responde o que lê as projeções.
   */
  declaredPage: { title: string; nodes: ResolvedPortalNode[]; loading: boolean } | null;
  /** O item do link não existe mais — saiu do menu, ou a extensão foi desligada. */
  entryMissing: boolean;
  /**
   * O registro aberto (o do link de um aviso, tipicamente) ainda não chegou — `loading` — ou não está
   * mais à vista do convidado — `missing`. `null` quando não há registro aberto, ou ele está à mão.
   */
  openedRecord: 'loading' | 'missing' | null;
  /**
   * Anexar ao registro aberto — só quando a tela deixa. O tipo é escolhido entre os oferecidos, sem
   * gesto de criar outro; e não há gesto de excluir.
   */
  upload: {
    collection: string;
    recordId: string;
    types: Array<{ value: string; label: string }>;
  } | null;
  /** O documento chega ao portal pela projeção, segundos depois: a lista é relida. */
  handleUploaded: () => void;
  records: PortalRecordCard[];
  /** O arranjo declarado da lista de topo; `null`, a lista de sempre. */
  recordsArrangement: PortalCardArrangement | null;
  recordsLoading: boolean;
  /** A tela de topo aceita registros do convidado — o pai é escolhido no formulário. */
  rootCreateLabel: string | null;
  emptyScreens: boolean;
  selected: {
    title: string;
    fields: PortalFieldView[];
    hasDocuments: boolean;
    documents: PortalDocumentView[];
    documentsLoading: boolean;
    children: PortalChildSection[];
    tabs: PortalRecordTab[];
    activeTab: string;
    /** O convidado pode alterar o registro aberto — o rótulo do botão; `null`, sem botão. */
    editLabel: string | null;
    /**
     * O registro aberto desenhado pela tela (`portal.template.detail.body`); `null`, o padrão. As abas
     * dos filhos e dos documentos vêm sempre depois dele.
     */
    body: ResolvedPortalNode[] | null;
    /**
     * O desenho posiciona o botão de alterar / as ações. O que ele não posiciona aparece no lugar de
     * sempre: o template arranja o que `portal.edit` e `portal.actions` decidiram, não os desliga.
     */
    placesEdit: boolean;
    placesActions: boolean;
  } | null;
  /**
   * As ações do escritório no registro aberto (`portal.actions`) — na casca nativa e em volta da view de
   * extensão de detalhe, como o "Voltar": a declaração é da tela, não de quem a desenha. `null`, sem ações.
   */
  recordActions: { collection: string; recordId: string } | null;
  startEdit: () => void;
  openRecord: (collection: string, id: string) => void;
  setActiveTab: (tab: string) => void;
  goBack: () => void;
  openDocument: (documentId: string) => Promise<void>;
  openingDocumentId: string | null;
  documentError: boolean;
  signOut: () => Promise<void>;
  /** O formulário aberto: a tela, e o registro-pai já fixado quando ele nasce dentro de um. */
  creating: {
    screen: PortalScreenInfo;
    parentRecordId: string | null;
    /** Alterando um registro: o id dele e o que o convidado vê dele, de onde o formulário parte. */
    editing: { recordId: string; values: Record<string, unknown>; labels: Record<string, string> } | null;
  } | null;
  startCreate: (collection: string) => void;
  /** "Novo" na lista de topo: o formulário pergunta a qual registro do convidado o novo pertence. */
  startRootCreate: () => void;
  cancelCreate: () => void;
  handleSubmitted: () => void;
  /** O registro enviado aparece quando o servidor o projeta — segundos depois. */
  justSubmitted: boolean;
  handleSaved: () => void;
  /** A alteração foi gravada — aparece quando o servidor refaz a projeção, segundos depois. */
  justSaved: boolean;
  /** A tela de EXTENSÃO para a lista de topo, quando há uma — no lugar da lista genérica. */
  listView: { Component: PortalViewComponent; collection: string } | null;
  /** A tela de extensão para o registro aberto, quando há uma. */
  detailView: { Component: PortalViewComponent; collection: string; recordId: string } | null;
}

export const usePortalViewModel = (): PortalViewModel => {
  const { tenantId: routeTenantId, entryId } = useParams<{ tenantId?: string; entryId?: string }>();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const portal = usePortal();
  const t = useT('core.tenant');
  const { formatDate } = useLocaleFormat();

  const navigation = usePortalNavigation();
  const { stack, creating, justSubmitted, justSaved } = navigation;
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState(false);
  const [documentsRevision, setDocumentsRevision] = useState(0);
  const [tabChoice, setTabChoice] = useState<{ recordId: string; tab: string }>({ recordId: '', tab: '' });

  const {
    memberships, membershipsLoading, selectTenant, getDocuments, getDocumentUrl, recordView, recordsByCollection, isCollectionLoading,
  } = portal;
  const screens = useMemo(() => portal.context?.screens ?? [], [portal.context]);

  useEffect(() => {
    if (routeTenantId) {
      selectTenant(routeTenantId);
      return;
    }
    if (!membershipsLoading && memberships.length === 1) {
      navigate(portalTenantPath(memberships[0].tenantId), { replace: true });
    }
  }, [routeTenantId, membershipsLoading, memberships, selectTenant, navigate]);

  const screenOf = useCallback(
    (collection: string) => screens.find((one) => one.collection === collection) ?? null,
    [screens],
  );

  // O menu chega pronto do servidor — telas de topo e páginas, na ordem do escritório. O item aberto é
  // o do ENDEREÇO: um link para "Notas" abre Notas, e voltar no navegador volta de verdade.
  const menuEntries = useMemo(() => portal.context?.home?.menu ?? [], [portal.context]);
  const entry = useMemo(
    () => (entryId ? menuEntries.find((one) => one.id === entryId) ?? null : null),
    [entryId, menuEntries],
  );
  const rootCollection = entry?.kind === 'screen' ? entry.collection ?? null : null;
  const rootScreen = useMemo(() => (rootCollection ? screenOf(rootCollection) : null), [rootCollection, screenOf]);

  const { formatValue, cardOf, answersOf } = usePortalRecordFormat();

  const records = useMemo<PortalRecordCard[]>(
    () => (rootScreen ? (recordsByCollection[rootScreen.collection] ?? []).map((record) => cardOf(rootScreen, record)) : []),
    [rootScreen, recordsByCollection, cardOf],
  );

  const top = stack.length > 0 ? stack[stack.length - 1] : null;
  const topScreen = top ? screenOf(top.collection) : null;
  const topRecord = useMemo(
    () => (top ? (recordsByCollection[top.collection] ?? []).find((record) => record.id === top.projectionId) ?? null : null),
    [top, recordsByCollection],
  );

  const topRecordId = topRecord?.id ?? null;
  const exposesDocuments = topScreen?.documents === true;
  const tracksViews = topScreen?.trackViews === true;
  const recordActions = useMemo(
    () => (topRecord && topScreen?.actions ? { collection: topRecord.collection, recordId: topRecord.recordId } : null),
    [topRecord, topScreen],
  );

  // A abertura conta quando o registro CHEGA à tela — a casca nativa ou a view de extensão de detalhe.
  // Quem decide se é a mesma abertura de há pouco é o servidor; a falha não atrapalha o convidado.
  useEffect(() => {
    if (!topRecordId || !tracksViews) return;
    recordView(topRecordId).catch(() => undefined);
  }, [topRecordId, tracksViews, recordView]);

  useEffect(() => {
    if (!topRecordId || !exposesDocuments) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abrir outro registro troca a lista de documentos
    setDocumentsLoading(true);
    setDocuments([]);
    getDocuments(topRecordId)
      .then((loaded) => { if (active) setDocuments(loaded); })
      .catch(() => { if (active) setDocuments([]); })
      .finally(() => { if (active) setDocumentsLoading(false); });
    return () => { active = false; };
  }, [topRecordId, exposesDocuments, getDocuments, documentsRevision]);

  const selected = useMemo(() => {
    if (!topRecord || !topScreen) return null;
    const parentKey = portalSubjectKey(topScreen.collection, topRecord.recordId);
    const children: PortalChildSection[] = screens
      .filter((child) => child.parent?.collection === topScreen.collection)
      .map((child) => ({
        collection: child.collection,
        title: child.titlePlural,
        screen: child,
        parentKey,
        createLabel: child.create ? t('portal.create.new', { screen: child.titleSingular }) : null,
      }));
    const tabs: PortalRecordTab[] = [
      ...children.map((child) => ({ key: child.collection, label: child.title })),
      ...(topScreen.documents ? [{ key: PORTAL_DOCUMENTS_TAB, label: t('portal.documents') }] : []),
    ];
    const editLabel = canEditPortalRecord(topScreen, topRecord, portal.userId) ? t('portal.edit.open') : null;
    const detailBody = topScreen.template?.detail?.body;
    return {
      title: topRecord.title || t('portal.record.untitled'),
      fields: topScreen.fields.map((field) => formatValue(field, topRecord)).filter((field) => field.value !== ''),
      hasDocuments: topScreen.documents,
      documents: documents.map((document) => ({
        id: document.id,
        name: document.name,
        meta: [document.type, document.createdAt ? formatDate(document.createdAt) : '']
          .filter((part) => !!part)
          .join(' · '),
        hash: document.sha256 ? t('portal.document.sha256', { hash: document.sha256 }) : '',
      })),
      documentsLoading,
      children,
      tabs,
      // A aba escolhida vale para ESTE registro; abrir outro volta à primeira.
      activeTab: tabChoice.recordId === topRecord.id && tabs.some((tab) => tab.key === tabChoice.tab)
        ? tabChoice.tab
        : tabs[0]?.key ?? '',
      editLabel,
      body: detailBody
        ? resolvePortalNodes(detailBody, answersOf(topScreen, topRecord, 'detail', { editLabel, hasActions: topScreen.actions }))
        : null,
      placesEdit: portalTemplatePlaces(detailBody, 'edit'),
      placesActions: portalTemplatePlaces(detailBody, 'actions'),
    };
  }, [topRecord, topScreen, documents, documentsLoading, screens, formatValue, formatDate, t, portal.userId, tabChoice, answersOf]);

  const openDocument = useCallback(async (documentId: string) => {
    if (!topRecord) return;
    // A janela abre ANTES da espera: aberta depois de uma promessa, o navegador a trata como pop-up
    // não pedido e a bloqueia.
    const opened = window.open('', '_blank');
    setOpeningDocumentId(documentId);
    setDocumentError(false);
    try {
      const url = await getDocumentUrl(topRecord.id, documentId);
      if (opened) opened.location.href = url;
      else window.location.href = url;
    } catch {
      opened?.close();
      setDocumentError(true);
    } finally {
      setOpeningDocumentId(null);
    }
  }, [topRecord, getDocumentUrl]);

  const handleUploaded = useCallback(() => {
    setTimeout(() => setDocumentsRevision((current) => current + 1), 2500);
    setTimeout(() => setDocumentsRevision((current) => current + 1), 6000);
  }, []);

  const chooseTenant = useCallback((tenantId: string) => navigate(portalTenantPath(tenantId)), [navigate]);

  const { openRecord: pushRecord, back, startCreate: openCreate, startEdit: openEdit } = navigation;

  const startEdit = useCallback(() => {
    if (topRecord) openEdit(topRecord.collection, topRecord.recordId);
  }, [openEdit, topRecord]);

  const openRecord = useCallback((collection: string, id: string) => {
    setDocumentError(false);
    pushRecord(collection, id);
  }, [pushRecord]);

  // O registro aberto por link, fora do menu (o filho de um aviso), não tem lista para onde voltar. O
  // aberto de um cartão da home volta pelo histórico — quem decide é a pilha.
  const backLeavesEntry = stack.length <= 1 && !entry && !navigation.returnsHome;
  const goBack = useCallback(() => {
    setDocumentError(false);
    if (backLeavesEntry) navigate(portalTenantPath(routeTenantId ?? ''));
    else back();
  }, [back, backLeavesEntry, navigate, routeTenantId]);

  // Criar DENTRO de um registro já fixa o pai: a nota nasce do prestador aberto, sem pergunta. Na
  // lista de topo, o formulário pergunta a qual dos registros do convidado o novo pertence.
  const startCreate = useCallback((collection: string) => {
    openCreate(collection, topRecord && topScreen?.collection !== collection ? topRecord.recordId : null);
  }, [openCreate, topRecord, topScreen]);

  const views = useMemo(() => portal.context?.views ?? [], [portal.context]);
  const viewFor = useCallback((collection: string, surface: 'list' | 'detail') => {
    const view = views.find((one) => one.collection === collection && one.surface === surface);
    return view ? evaluatePortalView(view) : null;
  }, [views]);
  const viewByKey = useCallback((pluginId: string | undefined, viewKey: string | undefined) => {
    const view = views.find((one) => one.pluginId === pluginId && one.viewKey === viewKey);
    return view ? evaluatePortalView(view) : null;
  }, [views]);

  const tenantPath = routeTenantId ?? '';
  const goHome = useCallback(() => navigate(portalTenantPath(tenantPath)), [navigate, tenantPath]);
  const homeConfig = portal.context?.home;
  const layoutChoice = homeConfig?.layout;
  const accountName = user?.displayName && !user.displayName.includes('@') ? user.displayName.trim() : '';
  const welcomeValues = portalWelcomeValues({
    accountName,
    email: user?.email ?? '',
    office: portal.context?.tenantName ?? '',
  });
  const greetsByName = !!accountName;
  const widgetOf = usePortalWidget();
  // O widget declarado sem nada a mostrar — nenhum registro e nenhum texto de vazio — não ocupa a home:
  // o portal não mostra moldura vazia.
  const homeWidgets = useMemo<PortalWidgetItem[]>(
    () => (homeConfig?.widgets ?? []).flatMap((widget): PortalWidgetItem[] => {
      if (widget.spec) {
        const { nodes, loading } = widgetOf(widget.spec);
        return loading || nodes.length > 0 ? [{ id: widget.id, title: widget.title, Component: null, nodes, loading }] : [];
      }
      const Component = viewByKey(widget.pluginId, widget.viewKey);
      return Component ? [{ id: widget.id, title: widget.title, Component, nodes: null, loading: false }] : [];
    }),
    [homeConfig, viewByKey, widgetOf],
  );
  // Um registro aberto de dentro da página fica por cima dela, como na página de código.
  const declaredPage = useMemo(() => {
    if (entry?.kind !== 'page' || !entry.spec || top) return null;
    const { nodes, loading } = widgetOf(entry.spec);
    return { title: entry.title, nodes, loading };
  }, [entry, top, widgetOf]);
  const ListComponent = rootCollection ? viewFor(rootCollection, 'list') : null;
  const DetailComponent = topRecord && topScreen ? viewFor(topScreen.collection, 'detail') : null;

  const showChooser = !routeTenantId;
  const loadFailed = !membershipsLoading && portal.membershipsFailed;
  const error = portalAccessError({
    userId: user?.id,
    membershipsLoading,
    membershipsFailed: portal.membershipsFailed,
    membershipCount: memberships.length,
    contextError: portal.error,
  });
  const creatingScreen = creating ? screenOf(creating.collection) : null;
  const editingRecord = creating?.recordId
    ? (recordsByCollection[creating.collection] ?? []).find((record) => record.recordId === creating.recordId) ?? null
    : null;

  return {
    loading: membershipsLoading || (!showChooser && portal.contextLoading),
    error,
    signInAgain: portalOffersSignInAgain(error, user?.id),
    errorCode: portal.errorCode,
    canRetry: loadFailed || portal.error === 'failed',
    retry: loadFailed ? portal.retryMemberships : portal.retryContext,
    signedInAs: user?.email ?? '',
    showChooser,
    memberships,
    chooseTenant,
    Layout: layoutChoice?.pluginId ? viewByKey(layoutChoice.pluginId, layoutChoice.viewKey) as PortalLayoutComponent | null : null,
    builtinLayout: layoutChoice?.id === 'top' ? 'top' : 'sidebar',
    atHome: !entryId,
    goHome,
    home: {
      // O nome do escritório já está na marca: a home cumprimenta a PESSOA.
      title: greetsByName ? t('portal.home.greeting', { name: welcomeValues.firstName }) : t('portal.home.greeting.anonymous'),
      welcome: fillPortalWelcome(homeConfig?.welcome ?? '', welcomeValues),
      widgets: homeWidgets,
      Component: homeConfig?.view ? viewByKey(homeConfig.view.pluginId, homeConfig.view.viewKey) : null,
    },
    // Um registro aberto de dentro da página fica por cima dela; o Voltar a devolve.
    pageView: entry?.kind === 'page' && entry.viewKey && !top ? viewByKey(entry.pluginId, entry.viewKey) : null,
    declaredPage,
    entryMissing: !!entryId && !!portal.context && !entry && !topScreen,
    openedRecord: top && topScreen && !topRecord
      ? (isCollectionLoading(top.collection) ? 'loading' : 'missing')
      : null,
    upload: topScreen?.uploads && topRecord
      ? {
        collection: topRecord.collection,
        recordId: topRecord.recordId,
        types: topScreen.uploads.types.map((option) => ({ value: option.key, label: option.label })),
      }
      : null,
    handleUploaded,
    records,
    recordsArrangement: portalCardArrangement(rootScreen),
    recordsLoading: rootCollection ? isCollectionLoading(rootCollection) : false,
    rootCreateLabel: rootScreen?.create ? t('portal.create.new', { screen: rootScreen.titleSingular }) : null,
    emptyScreens: !!portal.context && menuEntries.length === 0,
    selected,
    recordActions,
    openRecord,
    setActiveTab: (tab: string) => setTabChoice({ recordId: topRecord?.id ?? '', tab }),
    goBack,
    openDocument,
    openingDocumentId,
    documentError,
    signOut,
    creating: creating && creatingScreen && (!creating.recordId || editingRecord)
      ? {
        screen: creatingScreen,
        parentRecordId: creating.parentRecordId,
        editing: editingRecord ? { recordId: editingRecord.recordId, values: editingRecord.data, labels: editingRecord.labels } : null,
      }
      : null,
    startEdit,
    startCreate,
    startRootCreate: () => {
      if (rootCollection) openCreate(rootCollection, null);
    },
    cancelCreate: navigation.cancelCreate,
    handleSubmitted: navigation.submitted,
    handleSaved: navigation.saved,
    justSaved,
    listView: ListComponent && rootCollection ? { Component: ListComponent, collection: rootCollection } : null,
    detailView: DetailComponent && topRecord
      ? { Component: DetailComponent, collection: topRecord.collection, recordId: topRecord.recordId }
      : null,
    justSubmitted,
  };
};
