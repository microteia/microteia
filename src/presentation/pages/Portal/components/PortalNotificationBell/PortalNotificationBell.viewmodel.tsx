import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDI } from '../../../../../infrastructure/di/useDI';
import { useAuth } from '../../../../../stores/useAuth';
import { usePortal } from '../../../../../stores/usePortal';
import { useLocaleFormat } from '../../../../shared/i18n/useT';
import type { InboxNotification } from '../../../../../domain/entities/InboxNotification';
import { NOTIFICATION_INBOX_PAGE_SIZE } from '../../../../../domain/schema/notifications';
import { portalRecordPath } from '../../../../../domain/schema/portal';
import { makeSubscribeToPortalNotificationsUseCase } from '../../../../../domain/usecases/notifications/SubscribeToPortalNotificationsUseCase';
import { makeMarkNotificationsReadUseCase } from '../../../../../domain/usecases/notifications/MarkNotificationsReadUseCase';

export interface PortalNotificationBellItem {
  id: string;
  title: string;
  message: string;
  when: string;
  read: boolean;
  hasLink: boolean;
}

export interface PortalNotificationBellViewModel {
  visible: boolean;
  open: boolean;
  items: PortalNotificationBellItem[];
  /** Contadas entre as mais recentes que o sino mostra — o convidado não tem página de avisos. */
  unreadCount: number;
  unreadLabel: string;
  attachPanel: (node: HTMLDivElement | null) => void;
  toggle: () => void;
  openItem: (id: string) => void;
  markAllRead: () => void;
}

/**
 * O sino do CONVIDADO. Lê só os avisos ao portal dele — a regra não deixa ler outros —, e o clique
 * abre o registro NO PORTAL. O texto já chega no idioma dele, resolvido pelo servidor: aqui não há
 * referência a traduzir. Não há preferências nem push: o convidado recebe o que o escritório decidiu.
 */
export const usePortalNotificationBellViewModel = (): PortalNotificationBellViewModel => {
  const { notificationInboxRepository } = useDI();
  const { user } = useAuth();
  const { tenantId, context } = usePortal();
  const navigate = useNavigate();
  const { formatDateTime } = useLocaleFormat();

  const uc = useMemo(() => ({
    subscribe: makeSubscribeToPortalNotificationsUseCase(notificationInboxRepository),
    markRead: makeMarkNotificationsReadUseCase(notificationInboxRepository),
  }), [notificationInboxRepository]);

  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [panel, attachPanel] = useState<HTMLDivElement | null>(null);

  const userId = user?.id ?? '';
  const visible = !!tenantId && !!userId && !!context;

  useEffect(() => {
    if (!visible || !tenantId) return;
    return uc.subscribe.execute(tenantId, userId, NOTIFICATION_INBOX_PAGE_SIZE, setNotifications);
  }, [uc, visible, tenantId, userId]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (panel && !panel.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, panel]);

  const items = useMemo<PortalNotificationBellItem[]>(
    () => notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      when: formatDateTime(notification.createdAt),
      read: notification.read,
      hasLink: notification.target !== null,
    })),
    [notifications, formatDateTime],
  );

  const unread = useMemo(() => notifications.filter((notification) => !notification.read), [notifications]);

  const openItem = useCallback((id: string) => {
    const notification = notifications.find((one) => one.id === id);
    if (!notification || !tenantId) return;
    if (!notification.read) uc.markRead.execute(tenantId, [id]).catch(() => undefined);
    if (notification.target) {
      setOpen(false);
      navigate(portalRecordPath(tenantId, notification.target.collection, notification.target.recordId));
    }
  }, [notifications, tenantId, uc, navigate]);

  const markAllRead = useCallback(() => {
    if (!tenantId || unread.length === 0) return;
    uc.markRead.execute(tenantId, unread.map((notification) => notification.id)).catch(() => undefined);
  }, [tenantId, unread, uc]);

  return {
    visible,
    open,
    items,
    unreadCount: unread.length,
    unreadLabel: String(unread.length),
    attachPanel,
    toggle: () => setOpen((current) => !current),
    openItem,
    markAllRead,
  };
};
