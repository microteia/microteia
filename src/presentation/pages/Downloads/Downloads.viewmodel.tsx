import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDI } from '../../../infrastructure/di/useDI';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useNotification } from '../../../stores/useNotification';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { PERMISSION_DOWNLOADS_MANAGE } from '../../../domain/schema/access';
import type { DownloadItem, DownloadOrigin, DownloadVisibility } from '../../../domain/schema/document/documentDownloads';
import {
  isDownloadExpired,
  isPublicDownload,
  privateVisibilityOf,
} from '../../../domain/schema/document/documentDownloads';
import { DOWNLOAD_FILTER_KEYS, filterDownloads, NO_ORIGIN } from '../../../domain/services/downloadFilters';
import type { FilterDef, FilterOption, FilterToken } from '../../components/ui/CompositeFilter';
import { useResolvedDocumentTemplates } from '../../shared/documents/useResolvedDocumentTemplates';
import { useLabel, useLocaleFormat, useT } from '../../shared/i18n/useT';

export interface DownloadsListItem {
  id: string;
  name: string;
  url: string;
  /** De onde saiu, quando e por quem — a linha de baixo do item. */
  details: string;
  /** Até quando fica disponível, ou que não expira. */
  expiry: string;
  visibility: DownloadVisibility;
  visibilityLabel: string;
  isPublic: boolean;
  /** O registro de onde saiu — o destino que "Anexar a um registro" sugere primeiro. */
  origin: DownloadOrigin | null;
  /** Apagar é do dono e de quem gerencia: ver um arquivo público não dá o poder de apagá-lo. */
  canDelete: boolean;
}

export interface DownloadsViewModel {
  title: string;
  subtitle: string;
  items: DownloadsListItem[];
  isLoading: boolean;
  /** Não há arquivo nenhum — e não "nenhum passou no filtro". */
  isEmpty: boolean;
  isFilteredEmpty: boolean;

  filterDefs: FilterDef[];
  filterTokens: FilterToken[];
  setFilterTokens: (tokens: FilterToken[]) => void;
  savedFiltersScreenKey: string;

  /** Quem gerencia Downloads vê tudo e decide o que é público. */
  canManage: boolean;
  toggleVisibility: (item: DownloadsListItem) => Promise<void>;

  toAttach: DownloadsListItem | null;
  askAttach: (item: DownloadsListItem) => void;
  closeAttach: () => void;

  toDelete: DownloadsListItem | null;
  askDelete: (item: DownloadsListItem) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;
  labels: {
    empty: string;
    filteredEmpty: string;
    filterPlaceholder: string;
    download: string;
    attach: string;
    makePublic: string;
    makePrivate: string;
    remove: string;
    deleteTitle: string;
    deleteMessage: string;
    deleteConfirm: string;
  };
}

/** De quanto em quanto tempo a lista confere o que venceu — o TTL do Firestore pode levar até um dia. */
const EXPIRY_TICK_MS = 60_000;

const VISIBILITY_LABELS: Record<DownloadVisibility, string> = {
  owner: 'downloads.visibility.owner',
  everyone: 'downloads.visibility.everyone',
  managers: 'downloads.visibility.managers',
};

interface Snapshot {
  key: string;
  items: DownloadItem[];
}

const byLabel = (left: FilterOption, right: FilterOption): number => left.label.localeCompare(right.label);

export const useDownloadsViewModel = (): DownloadsViewModel => {
  const { downloadRepository } = useDI();
  const { currentTenant, members } = useTenant();
  const { user } = useAuth();
  const { can } = useAuthorization();
  const { notify } = useNotification();
  const { definitions } = useScreenDefinitions();
  const templates = useResolvedDocumentTemplates();
  const t = useT('core.documents');
  const label = useLabel();
  const { formatDateTime } = useLocaleFormat();

  const tenantId = currentTenant?.id ?? null;
  const userId = user?.id ?? null;
  const canManage = can(PERMISSION_DOWNLOADS_MANAGE);
  const scopeKey = tenantId && userId ? `${tenantId}:${userId}:${canManage}` : null;

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [toDelete, setToDelete] = useState<DownloadsListItem | null>(null);
  const [toAttach, setToAttach] = useState<DownloadsListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!tenantId || !userId || !scopeKey) return undefined;
    return downloadRepository.subscribe(
      tenantId,
      { userId, seeAll: canManage },
      (items) => setSnapshot({ key: scopeKey, items }),
      () => {
        setSnapshot({ key: scopeKey, items: [] });
        notify(t('downloads.load-failed'), 'error');
      },
    );
  }, [downloadRepository, tenantId, userId, canManage, scopeKey, notify, t]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, EXPIRY_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const current = snapshot && snapshot.key === scopeKey ? snapshot.items : null;

  const available = useMemo(
    () => (current && now ? current.filter((item) => !isDownloadExpired(item, now)) : []),
    [current, now],
  );

  const screenTitleOf = useCallback(
    (collection: string): string => {
      const screen =
        definitions.find((one) => one.dataCollection === collection)
        ?? definitions.find((one) => one.id === collection);
      return screen ? label(screen.titleSingular) : collection;
    },
    [definitions, label],
  );

  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.userId, member.displayName || member.email])),
    [members],
  );

  /** Quem gerou, como se lê: o nome do membro, o carimbado no item, ou "uma automação". */
  const creatorOf = useCallback(
    (item: DownloadItem): string =>
      memberNames.get(item.createdBy)
      ?? item.createdByName
      ?? (item.createdVia === 'automation' ? t('downloads.creator.automation') : t('downloads.creator.unknown')),
    [memberNames, t],
  );

  const templateTitleOf = useCallback(
    (key: string): string => {
      const template = templates.find((one) => one.key === key);
      return template ? label(template.title) : key;
    },
    [templates, label],
  );

  const originTitleOf = useCallback(
    (item: DownloadItem): string => (item.origin ? screenTitleOf(item.origin.collection) : t('downloads.origin.none')),
    [screenTitleOf, t],
  );

  const filterDefs = useMemo<FilterDef[]>(() => {
    const unique = (pairs: [string, string][]): FilterOption[] =>
      [...new Map(pairs).entries()].map(([value, text]) => ({ value, label: text })).sort(byLabel);
    return [
      { key: DOWNLOAD_FILTER_KEYS.search, label: t('core.ui/filter.search'), type: 'text', placeholder: t('downloads.search') },
      {
        key: DOWNLOAD_FILTER_KEYS.createdBy,
        label: t('downloads.filter.created-by'),
        type: 'multiselect',
        options: unique(available.map((item) => [item.createdBy, creatorOf(item)])),
      },
      {
        key: DOWNLOAD_FILTER_KEYS.via,
        label: t('downloads.filter.via'),
        type: 'multiselect',
        options: [
          { value: 'ui', label: t('downloads.via.ui') },
          { value: 'agent', label: t('downloads.via.agent') },
          { value: 'automation', label: t('downloads.via.automation') },
        ],
      },
      {
        key: DOWNLOAD_FILTER_KEYS.origin,
        label: t('downloads.filter.origin'),
        type: 'multiselect',
        options: unique(available.map((item) => [item.origin?.collection ?? NO_ORIGIN, originTitleOf(item)])),
      },
      {
        key: DOWNLOAD_FILTER_KEYS.template,
        label: t('downloads.filter.template'),
        type: 'multiselect',
        options: unique(available.flatMap((item): [string, string][] =>
          (item.templateKey ? [[item.templateKey, templateTitleOf(item.templateKey)]] : []))),
      },
      {
        key: DOWNLOAD_FILTER_KEYS.visibility,
        label: t('downloads.filter.visibility'),
        type: 'multiselect',
        options: (Object.keys(VISIBILITY_LABELS) as DownloadVisibility[])
          .map((visibility) => ({ value: visibility, label: t(VISIBILITY_LABELS[visibility]) })),
      },
      {
        key: DOWNLOAD_FILTER_KEYS.format,
        label: t('downloads.filter.format'),
        type: 'multiselect',
        options: [
          { value: 'pdf', label: t('output.pdf') },
          { value: 'docx', label: t('output.docx') },
          { value: 'other', label: t('downloads.format.other') },
        ],
      },
      { key: DOWNLOAD_FILTER_KEYS.createdFrom, label: t('downloads.filter.created-from'), type: 'date' },
      { key: DOWNLOAD_FILTER_KEYS.createdTo, label: t('downloads.filter.created-to'), type: 'date' },
      {
        key: DOWNLOAD_FILTER_KEYS.expires,
        label: t('downloads.filter.expires'),
        type: 'multiselect',
        options: [
          { value: 'day', label: t('downloads.expires.day') },
          { value: 'week', label: t('downloads.expires.week') },
          { value: 'never', label: t('downloads.expires.never') },
        ],
      },
    ];
  }, [available, creatorOf, originTitleOf, templateTitleOf, t]);

  const items = useMemo<DownloadsListItem[]>(() => {
    if (!now) return [];
    const searchText = (item: DownloadItem): string =>
      [item.name, creatorOf(item), originTitleOf(item), item.templateKey ? templateTitleOf(item.templateKey) : '']
        .join(' ');
    return filterDownloads(available, filterTokens, now, searchText).map((item) => {
      const parts = [
        item.origin ? screenTitleOf(item.origin.collection) : null,
        item.createdAt ? t('downloads.created-at', { date: formatDateTime(item.createdAt) }) : null,
        t('downloads.by', { name: creatorOf(item) }),
      ].filter((part): part is string => !!part);
      return {
        id: item.id,
        name: item.name,
        url: item.url,
        details: parts.join(' · '),
        expiry: item.expiresAt
          ? t('downloads.expires-at', { date: formatDateTime(item.expiresAt) })
          : t('downloads.never-expires'),
        visibility: item.visibility,
        visibilityLabel: t(VISIBILITY_LABELS[item.visibility]),
        isPublic: isPublicDownload(item),
        origin: item.origin ?? null,
        canDelete: canManage || item.ownerId === userId,
      };
    });
  }, [available, filterTokens, now, creatorOf, originTitleOf, templateTitleOf, screenTitleOf, t, formatDateTime, canManage, userId]);

  const toggleVisibility = useCallback(async (item: DownloadsListItem) => {
    if (!tenantId || !canManage) return;
    const source = available.find((one) => one.id === item.id);
    if (!source) return;
    const next = item.isPublic ? privateVisibilityOf(source) : 'everyone';
    try {
      await downloadRepository.setVisibility(tenantId, item.id, next);
      notify(t(next === 'everyone' ? 'downloads.made-public' : 'downloads.made-private'), 'success');
    } catch {
      notify(t('downloads.visibility-failed'), 'error');
    }
  }, [tenantId, canManage, available, downloadRepository, notify, t]);

  const askAttach = useCallback((item: DownloadsListItem) => setToAttach(item), []);
  const closeAttach = useCallback(() => setToAttach(null), []);

  const askDelete = useCallback((item: DownloadsListItem) => setToDelete(item), []);
  const cancelDelete = useCallback(() => setToDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!tenantId || !toDelete) return;
    setIsDeleting(true);
    try {
      await downloadRepository.delete(tenantId, toDelete.id);
      notify(t('downloads.deleted'), 'success');
      setToDelete(null);
    } catch {
      notify(t('downloads.delete-failed'), 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [downloadRepository, tenantId, toDelete, notify, t]);

  const isLoading = current === null || now === null;

  return {
    title: t('page.downloads'),
    subtitle: t('downloads.subtitle'),
    items,
    isLoading,
    isEmpty: !isLoading && available.length === 0,
    isFilteredEmpty: !isLoading && available.length > 0 && items.length === 0,
    filterDefs,
    filterTokens,
    setFilterTokens,
    savedFiltersScreenKey: 'downloads',
    canManage,
    toggleVisibility,
    toAttach,
    askAttach,
    closeAttach,
    toDelete,
    askDelete,
    cancelDelete,
    confirmDelete,
    isDeleting,
    labels: {
      empty: t('downloads.empty'),
      filteredEmpty: t('downloads.filtered-empty'),
      filterPlaceholder: t('downloads.search'),
      download: t('downloads.download'),
      attach: t('downloads.attach'),
      makePublic: t('downloads.make-public'),
      makePrivate: t('downloads.make-private'),
      remove: t('downloads.delete'),
      deleteTitle: t('downloads.delete.title'),
      deleteMessage: toDelete ? t('downloads.delete.confirm', { name: toDelete.name }) : '',
      deleteConfirm: t('downloads.delete'),
    },
  };
};
