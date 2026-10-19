import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../stores/useAuth';
import { usePortal } from '../../../stores/usePortal';
import { usePortalNavigation } from '../../../stores/usePortalNavigation';
import { useLocaleFormat, useT } from '../../shared/i18n/useT';
import type { PortalDocument, PortalRecord, PortalScreenInfo } from '../../../domain/entities/Portal';
import { portalSubjectKey } from '../../../domain/schema/portal';
import { PORTAL_PATH, portalEntryPath, portalTenantPath } from './portalPaths';
import { evaluatePortalView, type PortalViewComponent } from './portalViews';

const SUMMARY_FIELDS = 3;

export interface PortalFieldView {
  key: string;
  label: string;
  value: string;
  /** Presente quando o valor é um arquivo — o campo exposto é o link dele. */
  href: string | null;
}

export interface PortalRecordCard {
  collection: string;
  id: string;
  title: string;
  summary: string;
  updatedAt: string;
}

export interface PortalDocumentView {
  id: string;
  name: string;
  meta: string;
}

/** Uma entrada do menu, como o menu a desenha — nos blocos da home, nas abas e na barra. */
export interface PortalMenuItem {
  id: string;
  title: string;
  icon: string;
  active: boolean;
}

/** Um cartão da home: a view da extensão, com o título que ela declarou. */
export interface PortalWidgetItem {
  id: string;
  title: string;
  Component: PortalViewComponent;
}

/** Quantos itens cabem na barra do celular antes do "Mais" — além do "Início". */
const BOTTOM_BAR_ITEMS = 3;

/** Uma tela-filha dentro do registro aberto: as notas do prestador. */
export interface PortalChildSection {
  collection: string;
  title: string;
  /** O rótulo do botão, já com o nome da tela. */
  createLabel: string | null;
  loading: boolean;
  records: PortalRecordCard[];
}

export interface PortalViewModel {
  loading: boolean;
  error: 'no-access' | 'load-failed' | 'not-invited' | 'context-failed' | null;
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
  goToChooser: () => void;
  tenantName: string;
  logoURL: string | null;
  /**
   * O MENU: as telas de topo e as páginas de extensão, na ordem do escritório. É uma lista só, e os
   * três lugares onde ele aparece — blocos da home, abas no computador, barra no celular — a leem.
   */
  menu: PortalMenuItem[];
  /** A barra do celular: os primeiros itens; o resto vai para o "Mais". */
  bottomBar: PortalMenuItem[];
  hasMore: boolean;
  moreOpen: boolean;
  toggleMore: () => void;
  openEntry: (id: string) => void;
  atHome: boolean;
  goHome: () => void;
  home: {
    title: string;
    /** As boas-vindas do escritório — dado dele, sem tradução. */
    welcome: string;
    widgets: PortalWidgetItem[];
    /** A home inteira de uma extensão, quando há uma. */
    Component: PortalViewComponent | null;
  };
  /** A página de extensão aberta pelo menu. */
  pageView: PortalViewComponent | null;
  /** O item do link não existe mais — saiu do menu, ou a extensão foi desligada. */
  entryMissing: boolean;
  records: PortalRecordCard[];
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
  } | null;
  openRecord: (collection: string, id: string) => void;
  goBack: () => void;
  openDocument: (documentId: string) => Promise<void>;
  openingDocumentId: string | null;
  documentError: boolean;
  signOut: () => Promise<void>;
  /** O formulário aberto: a tela, e o registro-pai já fixado quando ele nasce dentro de um. */
  creating: { screen: PortalScreenInfo; parentRecordId: string | null } | null;
  startCreate: (collection: string) => void;
  /** "Novo" na lista de topo: o formulário pergunta a qual registro do convidado o novo pertence. */
  startRootCreate: () => void;
  cancelCreate: () => void;
  handleSubmitted: () => void;
  /** O registro enviado aparece quando o servidor o projeta — segundos depois. */
  justSubmitted: boolean;
  /** A tela de EXTENSÃO para a lista de topo, quando há uma — no lugar da lista genérica. */
  listView: { Component: PortalViewComponent; collection: string } | null;
  /** A tela de extensão para o registro aberto, quando há uma. */
  detailView: { Component: PortalViewComponent; collection: string; recordId: string } | null;
}

const optionLabel = (field: PortalScreenInfo['fields'][number], key: unknown): string =>
  field.options?.find((option) => option.key === key)?.label ?? String(key);

export const usePortalViewModel = (): PortalViewModel => {
  const { tenantId: routeTenantId, entryId } = useParams<{ tenantId?: string; entryId?: string }>();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const portal = usePortal();
  const t = useT('core.tenant');
  const { formatDate, formatMoney, formatNumber } = useLocaleFormat();

  const navigation = usePortalNavigation();
  const { stack, creating, justSubmitted } = navigation;
  const [moreOpen, setMoreOpen] = useState(false);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState(false);

  const { memberships, membershipsLoading, selectTenant, getDocuments, getDocumentUrl, recordsByCollection, isCollectionLoading } = portal;
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

  const formatValue = useCallback((field: PortalScreenInfo['fields'][number], record: PortalRecord): PortalFieldView => {
    const raw = record.data[field.key];
    const base = { key: field.key, label: field.label, href: null };
    if (raw === undefined || raw === null || raw === '') return { ...base, value: '' };
    switch (field.type) {
      case 'reference':
        return { ...base, value: record.labels[field.key] ?? '' };
      case 'select':
        return { ...base, value: Array.isArray(raw) ? raw.map((key) => optionLabel(field, key)).join(', ') : optionLabel(field, raw) };
      case 'checkbox':
        return { ...base, value: raw === true ? t('portal.value.yes') : t('portal.value.no') };
      case 'date':
        return { ...base, value: formatDate(raw) };
      case 'currency':
        return { ...base, value: typeof raw === 'number' ? formatMoney(raw) : String(raw) };
      case 'number':
        return { ...base, value: typeof raw === 'number' ? formatNumber(raw) : String(raw) };
      case 'file':
        return { ...base, value: t('portal.document.open'), href: typeof raw === 'string' ? raw : null };
      default:
        return { ...base, value: Array.isArray(raw) ? raw.join(', ') : String(raw) };
    }
  }, [t, formatDate, formatMoney, formatNumber]);

  const cardOf = useCallback((screen: PortalScreenInfo, record: PortalRecord): PortalRecordCard => ({
    collection: screen.collection,
    id: record.id,
    title: record.title || t('portal.record.untitled'),
    summary: screen.fields
      .map((field) => formatValue(field, record))
      .filter((field) => field.value !== '' && field.href === null)
      .slice(0, SUMMARY_FIELDS)
      .map((field) => `${field.label}: ${field.value}`)
      .join(' · '),
    updatedAt: record.updatedAt ? t('portal.record.updated', { date: formatDate(record.updatedAt) }) : '',
  }), [formatValue, formatDate, t]);

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
  }, [topRecordId, exposesDocuments, getDocuments]);

  const selected = useMemo(() => {
    if (!topRecord || !topScreen) return null;
    const parentKey = portalSubjectKey(topScreen.collection, topRecord.recordId);
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
      })),
      documentsLoading,
      children: screens
        .filter((child) => child.parent?.collection === topScreen.collection)
        .map((child) => ({
          collection: child.collection,
          title: child.titlePlural,
          createLabel: child.create ? t('portal.create.new', { screen: child.titleSingular }) : null,
          loading: isCollectionLoading(child.collection),
          records: (recordsByCollection[child.collection] ?? [])
            .filter((record) => record.parentKeys.includes(parentKey))
            .map((record) => cardOf(child, record)),
        })),
    };
  }, [topRecord, topScreen, documents, documentsLoading, screens, recordsByCollection, isCollectionLoading, formatValue, formatDate, cardOf, t]);

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

  const chooseTenant = useCallback((tenantId: string) => navigate(portalTenantPath(tenantId)), [navigate]);

  const { openRecord: pushRecord, back, startCreate: openCreate } = navigation;

  const openRecord = useCallback((collection: string, id: string) => {
    setDocumentError(false);
    pushRecord(collection, id);
  }, [pushRecord]);

  const goBack = useCallback(() => {
    setDocumentError(false);
    back();
  }, [back]);

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
  const openEntry = useCallback((id: string) => {
    setMoreOpen(false);
    navigate(portalEntryPath(tenantPath, id));
  }, [navigate, tenantPath]);
  const goHome = useCallback(() => {
    setMoreOpen(false);
    navigate(portalTenantPath(tenantPath));
  }, [navigate, tenantPath]);

  const menu = useMemo<PortalMenuItem[]>(
    () => menuEntries.map((one) => ({ id: one.id, title: one.title, icon: one.icon, active: one.id === entryId })),
    [menuEntries, entryId],
  );
  const homeConfig = portal.context?.home;
  const homeWidgets = useMemo<PortalWidgetItem[]>(
    () => (homeConfig?.widgets ?? []).flatMap((widget) => {
      const Component = viewByKey(widget.pluginId, widget.viewKey);
      return Component ? [{ id: widget.id, title: widget.title, Component }] : [];
    }),
    [homeConfig, viewByKey],
  );
  const ListComponent = rootCollection ? viewFor(rootCollection, 'list') : null;
  const DetailComponent = topRecord && topScreen ? viewFor(topScreen.collection, 'detail') : null;

  const showChooser = !routeTenantId;
  const noAccess = !membershipsLoading && memberships.length === 0;
  const loadFailed = !membershipsLoading && portal.membershipsFailed;
  const creatingScreen = creating ? screenOf(creating.collection) : null;

  return {
    loading: membershipsLoading || (!showChooser && portal.contextLoading),
    error: loadFailed
      ? 'load-failed'
      : noAccess
        ? 'no-access'
        : portal.error === 'not-invited' ? 'not-invited' : portal.error === 'failed' ? 'context-failed' : null,
    errorCode: portal.errorCode,
    canRetry: loadFailed || portal.error === 'failed',
    retry: loadFailed ? portal.retryMemberships : portal.retryContext,
    signedInAs: user?.email ?? '',
    showChooser,
    memberships,
    chooseTenant,
    goToChooser: () => navigate(PORTAL_PATH),
    tenantName: portal.context?.tenantName ?? '',
    logoURL: portal.context?.logoURL ?? null,
    menu,
    bottomBar: menu.slice(0, BOTTOM_BAR_ITEMS),
    hasMore: menu.length > BOTTOM_BAR_ITEMS,
    moreOpen,
    toggleMore: () => setMoreOpen((open) => !open),
    openEntry,
    atHome: !entryId,
    goHome,
    home: {
      title: t('portal.home.title', { tenant: portal.context?.tenantName ?? '' }),
      welcome: homeConfig?.welcome ?? '',
      widgets: homeWidgets,
      Component: homeConfig?.view ? viewByKey(homeConfig.view.pluginId, homeConfig.view.viewKey) : null,
    },
    pageView: entry?.kind === 'page' ? viewByKey(entry.pluginId, entry.viewKey) : null,
    entryMissing: !!entryId && !!portal.context && !entry,
    records,
    recordsLoading: rootCollection ? isCollectionLoading(rootCollection) : false,
    rootCreateLabel: rootScreen?.create ? t('portal.create.new', { screen: rootScreen.titleSingular }) : null,
    emptyScreens: !!portal.context && screens.length === 0,
    selected,
    openRecord,
    goBack,
    openDocument,
    openingDocumentId,
    documentError,
    signOut,
    creating: creating && creatingScreen ? { screen: creatingScreen, parentRecordId: creating.parentRecordId } : null,
    startCreate,
    startRootCreate: () => {
      if (rootCollection) openCreate(rootCollection, null);
    },
    cancelCreate: navigation.cancelCreate,
    handleSubmitted: navigation.submitted,
    listView: ListComponent && rootCollection ? { Component: ListComponent, collection: rootCollection } : null,
    detailView: DetailComponent && topRecord
      ? { Component: DetailComponent, collection: topRecord.collection, recordId: topRecord.recordId }
      : null,
    justSubmitted,
  };
};
