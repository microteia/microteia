import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../stores/useAuth';
import { usePortal } from '../../../stores/usePortal';
import { usePortalNavigation } from '../../../stores/usePortalNavigation';
import { useLocaleFormat, useT } from '../../shared/i18n/useT';
import type { PortalDocument, PortalRecord, PortalScreenInfo } from '../../../domain/entities/Portal';
import { portalSubjectKey } from '../../../domain/schema/portal';
import { PORTAL_PATH, portalTenantPath } from './portalPaths';
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

export interface PortalScreenTab {
  collection: string;
  label: string;
  icon: string;
  active: boolean;
}

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
  /** Só as telas de TOPO: as filhas aparecem dentro do pai. */
  screens: PortalScreenTab[];
  selectScreen: (collection: string) => void;
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
  const { tenantId: routeTenantId } = useParams<{ tenantId?: string }>();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const portal = usePortal();
  const t = useT('core.tenant');
  const { formatDate, formatMoney, formatNumber } = useLocaleFormat();

  const navigation = usePortalNavigation();
  const { rootChoice, stack, creating, justSubmitted } = navigation;
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

  // Raiz é a tela sem pai NO PORTAL. Uma nota cujo prestador não está exposto continua de topo: não
  // há pai onde mostrá-la.
  const roots = useMemo(() => screens.filter((one) => !one.parent || !screenOf(one.parent.collection)), [screens, screenOf]);
  const rootCollection = rootChoice && roots.some((one) => one.collection === rootChoice)
    ? rootChoice
    : roots[0]?.collection ?? null;
  const rootScreen = rootCollection ? screenOf(rootCollection) : null;

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

  const { selectRoot, openRecord: pushRecord, back, startCreate: openCreate } = navigation;

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
    screens: roots.map((one) => ({
      collection: one.collection,
      label: one.titlePlural,
      icon: one.icon,
      active: one.collection === rootCollection,
    })),
    selectScreen: selectRoot,
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
