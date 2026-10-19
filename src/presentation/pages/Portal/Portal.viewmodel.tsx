import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../stores/useAuth';
import { usePortal } from '../../../stores/usePortal';
import { useLocaleFormat, useT } from '../../shared/i18n/useT';
import type { PortalDocument, PortalRecord, PortalScreenInfo } from '../../../domain/entities/Portal';
import { PORTAL_PATH, portalTenantPath } from './portalPaths';

const SUMMARY_FIELDS = 3;

export interface PortalFieldView {
  key: string;
  label: string;
  value: string;
  /** Presente quando o valor é um arquivo — o campo exposto é o link dele. */
  href: string | null;
}

export interface PortalRecordCard {
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

export interface PortalViewModel {
  loading: boolean;
  error: 'no-access' | 'load-failed' | 'not-invited' | null;
  /** Com que conta a pessoa entrou — o "sem acesso" mais comum é estar na conta errada. */
  signedInAs: string;
  showChooser: boolean;
  memberships: Array<{ tenantId: string; tenantName: string }>;
  chooseTenant: (tenantId: string) => void;
  goToChooser: () => void;
  tenantName: string;
  logoURL: string | null;
  screens: PortalScreenTab[];
  selectScreen: (collection: string) => void;
  records: PortalRecordCard[];
  recordsLoading: boolean;
  emptyScreens: boolean;
  selected: {
    title: string;
    fields: PortalFieldView[];
    hasDocuments: boolean;
    documents: PortalDocumentView[];
    documentsLoading: boolean;
  } | null;
  openRecord: (id: string) => void;
  closeRecord: () => void;
  openDocument: (documentId: string) => Promise<void>;
  openingDocumentId: string | null;
  documentError: boolean;
  signOut: () => Promise<void>;
  /** A tela aceita registros do convidado — e, se aceita, a tela é esta. */
  createScreen: PortalScreenInfo | null;
  creating: boolean;
  startCreate: () => void;
  cancelCreate: () => void;
  handleSubmitted: () => void;
  /** O registro enviado aparece na lista quando o servidor o projeta — segundos depois. */
  justSubmitted: boolean;
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const { memberships, membershipsLoading, selectTenant, getDocuments, getDocumentUrl, selectCollection } = portal;

  useEffect(() => {
    if (routeTenantId) {
      selectTenant(routeTenantId);
      return;
    }
    if (!membershipsLoading && memberships.length === 1) {
      navigate(portalTenantPath(memberships[0].tenantId), { replace: true });
    }
  }, [routeTenantId, membershipsLoading, memberships, selectTenant, navigate]);

  const screen = useMemo(
    () => portal.context?.screens.find((one) => one.collection === portal.collection) ?? null,
    [portal.context, portal.collection],
  );

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

  const records = useMemo<PortalRecordCard[]>(() => portal.records.map((record) => ({
    id: record.id,
    title: record.title || t('portal.record.untitled'),
    summary: (screen?.fields ?? [])
      .map((field) => formatValue(field, record))
      .filter((field) => field.value !== '' && field.href === null)
      .slice(0, SUMMARY_FIELDS)
      .map((field) => `${field.label}: ${field.value}`)
      .join(' · '),
    updatedAt: record.updatedAt ? t('portal.record.updated', { date: formatDate(record.updatedAt) }) : '',
  })), [portal.records, screen, formatValue, formatDate, t]);

  const selectedRecord = useMemo(
    () => portal.records.find((record) => record.id === selectedId) ?? null,
    [portal.records, selectedId],
  );

  const selectedRecordId = selectedRecord?.id ?? null;
  const exposesDocuments = screen?.documents === true;

  useEffect(() => {
    if (!selectedRecordId || !exposesDocuments) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abrir outro registro troca a lista de documentos
    setDocumentsLoading(true);
    setDocuments([]);
    getDocuments(selectedRecordId)
      .then((loaded) => { if (active) setDocuments(loaded); })
      .catch(() => { if (active) setDocuments([]); })
      .finally(() => { if (active) setDocumentsLoading(false); });
    return () => { active = false; };
  }, [selectedRecordId, exposesDocuments, getDocuments]);

  const selected = useMemo(() => {
    if (!selectedRecord || !screen) return null;
    return {
      title: selectedRecord.title || t('portal.record.untitled'),
      fields: screen.fields.map((field) => formatValue(field, selectedRecord)).filter((field) => field.value !== ''),
      hasDocuments: screen.documents,
      documents: documents.map((document) => ({
        id: document.id,
        name: document.name,
        meta: [document.type, document.createdAt ? formatDate(document.createdAt) : '']
          .filter((part) => !!part)
          .join(' · '),
      })),
      documentsLoading,
    };
  }, [selectedRecord, screen, documents, documentsLoading, formatValue, formatDate, t]);

  const openDocument = useCallback(async (documentId: string) => {
    if (!selectedRecord) return;
    // A janela abre ANTES da espera: aberta depois de uma promessa, o navegador a trata como pop-up
    // não pedido e a bloqueia.
    const opened = window.open('', '_blank');
    setOpeningDocumentId(documentId);
    setDocumentError(false);
    try {
      const url = await getDocumentUrl(selectedRecord.id, documentId);
      if (opened) opened.location.href = url;
      else window.location.href = url;
    } catch {
      opened?.close();
      setDocumentError(true);
    } finally {
      setOpeningDocumentId(null);
    }
  }, [selectedRecord, getDocumentUrl]);

  const chooseTenant = useCallback((tenantId: string) => navigate(portalTenantPath(tenantId)), [navigate]);

  const selectScreen = useCallback((collection: string) => {
    setSelectedId(null);
    setCreating(false);
    setJustSubmitted(false);
    selectCollection(collection);
  }, [selectCollection]);

  const showChooser = !routeTenantId;
  const noAccess = !membershipsLoading && memberships.length === 0;
  const loadFailed = !membershipsLoading && portal.membershipsFailed;

  return {
    loading: membershipsLoading || (!showChooser && portal.contextLoading),
    error: loadFailed ? 'load-failed' : noAccess ? 'no-access' : portal.error ? 'not-invited' : null,
    signedInAs: user?.email ?? '',
    showChooser,
    memberships,
    chooseTenant,
    goToChooser: () => navigate(PORTAL_PATH),
    tenantName: portal.context?.tenantName ?? '',
    logoURL: portal.context?.logoURL ?? null,
    screens: (portal.context?.screens ?? []).map((one) => ({
      collection: one.collection,
      label: one.titlePlural,
      icon: one.icon,
      active: one.collection === portal.collection,
    })),
    selectScreen,
    records,
    recordsLoading: portal.recordsLoading,
    emptyScreens: !!portal.context && portal.context.screens.length === 0,
    selected,
    openRecord: setSelectedId,
    closeRecord: () => setSelectedId(null),
    openDocument,
    openingDocumentId,
    documentError,
    signOut,
    createScreen: screen?.create ? screen : null,
    creating,
    startCreate: () => {
      setSelectedId(null);
      setJustSubmitted(false);
      setCreating(true);
    },
    cancelCreate: () => setCreating(false),
    handleSubmitted: () => {
      setCreating(false);
      setJustSubmitted(true);
    },
    justSubmitted,
  };
};
