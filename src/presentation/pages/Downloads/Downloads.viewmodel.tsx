import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDI } from '../../../infrastructure/di/useDI';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useNotification } from '../../../stores/useNotification';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { PERMISSION_DOWNLOADS_MANAGE } from '../../../domain/schema/access';
import type { DownloadItem } from '../../../domain/schema/document/documentDownloads';
import { isDownloadExpired } from '../../../domain/schema/document/documentDownloads';
import { useLabel, useLocaleFormat, useT } from '../../shared/i18n/useT';

export interface DownloadsListItem {
  id: string;
  name: string;
  url: string;
  /** De onde saiu, quando e por quem — a linha de baixo do item. */
  details: string;
  /** Até quando fica disponível, ou que não expira. */
  expiry: string;
}

export interface DownloadsViewModel {
  title: string;
  subtitle: string;
  items: DownloadsListItem[];
  isLoading: boolean;
  isEmpty: boolean;
  toDelete: DownloadsListItem | null;
  askDelete: (item: DownloadsListItem) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;
  labels: {
    empty: string;
    download: string;
    remove: string;
    deleteTitle: string;
    deleteMessage: string;
    deleteConfirm: string;
  };
}

/** De quanto em quanto tempo a lista confere o que venceu — o TTL do Firestore pode levar até um dia. */
const EXPIRY_TICK_MS = 60_000;

interface Snapshot {
  key: string;
  items: DownloadItem[];
}

export const useDownloadsViewModel = (): DownloadsViewModel => {
  const { downloadRepository } = useDI();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { can } = useAuthorization();
  const { notify } = useNotification();
  const { definitions } = useScreenDefinitions();
  const t = useT('core.documents');
  const label = useLabel();
  const { formatDateTime } = useLocaleFormat();

  const tenantId = currentTenant?.id ?? null;
  const userId = user?.id ?? null;
  const seeAll = can(PERMISSION_DOWNLOADS_MANAGE);
  const scopeKey = tenantId && userId ? `${tenantId}:${userId}:${seeAll}` : null;

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [toDelete, setToDelete] = useState<DownloadsListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!tenantId || !userId || !scopeKey) return undefined;
    return downloadRepository.subscribe(
      tenantId,
      { userId, seeAll },
      (items) => setSnapshot({ key: scopeKey, items }),
      () => {
        setSnapshot({ key: scopeKey, items: [] });
        notify(t('downloads.load-failed'), 'error');
      },
    );
  }, [downloadRepository, tenantId, userId, seeAll, scopeKey, notify, t]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, EXPIRY_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const current = snapshot && snapshot.key === scopeKey ? snapshot.items : null;

  const screenTitleOf = useCallback(
    (collection: string): string => {
      const screen =
        definitions.find((one) => one.dataCollection === collection)
        ?? definitions.find((one) => one.id === collection);
      return screen ? label(screen.titleSingular) : collection;
    },
    [definitions, label],
  );

  const items = useMemo<DownloadsListItem[]>(() => {
    if (!current || !now) return [];
    return current
      .filter((item) => !isDownloadExpired(item, now))
      .map((item) => {
        const parts = [
          item.origin ? screenTitleOf(item.origin.collection) : null,
          item.createdAt ? t('downloads.created-at', { date: formatDateTime(item.createdAt) }) : null,
          seeAll
            ? item.createdByName
              ? t('downloads.by', { name: item.createdByName })
              : item.createdVia === 'automation' ? t('downloads.by-automation') : null
            : null,
        ].filter((part): part is string => !!part);
        return {
          id: item.id,
          name: item.name,
          url: item.url,
          details: parts.join(' · '),
          expiry: item.expiresAt
            ? t('downloads.expires-at', { date: formatDateTime(item.expiresAt) })
            : t('downloads.never-expires'),
        };
      });
  }, [current, now, screenTitleOf, seeAll, t, formatDateTime]);

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
    isEmpty: !isLoading && items.length === 0,
    toDelete,
    askDelete,
    cancelDelete,
    confirmDelete,
    isDeleting,
    labels: {
      empty: t('downloads.empty'),
      download: t('downloads.download'),
      remove: t('downloads.delete'),
      deleteTitle: t('downloads.delete.title'),
      deleteMessage: toDelete ? t('downloads.delete.confirm', { name: toDelete.name }) : '',
      deleteConfirm: t('downloads.delete'),
    },
  };
};
