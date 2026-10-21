import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useAuth } from '../../../../stores/useAuth';
import { useTenant } from '../../../../stores/useTenant';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useOpenLink } from '../../../shared/useOpenLink';
import { recordLinkTabKey } from '../../../../domain/schema/recordLink';
import { NOTIFICATIONS_PAGE_KEY } from '../../../../domain/schema/notifications';
import { useNotification } from '../../../../stores/useNotification';
import { useLabel, useLocaleFormat } from '../../../shared/i18n/useT';
import type { DevicePushStatus, InboxNotification } from '../../../../domain/entities/InboxNotification';
import { NOTIFICATION_INBOX_PAGE_SIZE, NOTIFICATION_UNREAD_CAP } from '../../../../domain/schema/notifications';
import { makeSubscribeToNotificationInboxUseCase } from '../../../../domain/usecases/notifications/SubscribeToNotificationInboxUseCase';
import { makeSubscribeToUnreadNotificationsUseCase } from '../../../../domain/usecases/notifications/SubscribeToUnreadNotificationsUseCase';
import { makeMarkNotificationsReadUseCase } from '../../../../domain/usecases/notifications/MarkNotificationsReadUseCase';
import { makeMarkAllNotificationsReadUseCase } from '../../../../domain/usecases/notifications/MarkAllNotificationsReadUseCase';
import { makeManageDevicePushUseCase } from '../../../../domain/usecases/notifications/ManageDevicePushUseCase';

export interface NotificationBellItem {
  id: string;
  title: string;
  message: string;
  when: string;
  read: boolean;
  hasLink: boolean;
}

export interface NotificationBellViewModel {
  visible: boolean;
  open: boolean;
  items: NotificationBellItem[];
  unreadCount: number;
  unreadLabel: string;
  pushStatus: DevicePushStatus;
  pushBusy: boolean;
  attachPanel: (node: HTMLDivElement | null) => void;
  toggle: () => void;
  openItem: (id: string) => void;
  markAllRead: () => void;
  /** A página com todos os avisos, filtros e preferências por tipo. */
  seeAll: () => void;
  enablePush: () => void;
  disablePush: () => void;
}

export const useNotificationBellViewModel = (): NotificationBellViewModel => {
  const { notificationInboxRepository, devicePushService } = useDI();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { openTab } = useWorkspace();
  const openLink = useOpenLink();
  const { notify } = useNotification();
  const label = useLabel();
  const { formatDateTime } = useLocaleFormat();

  const uc = useMemo(() => ({
    subscribeInbox: makeSubscribeToNotificationInboxUseCase(notificationInboxRepository),
    subscribeUnread: makeSubscribeToUnreadNotificationsUseCase(notificationInboxRepository),
    markRead: makeMarkNotificationsReadUseCase(notificationInboxRepository),
    markAllRead: makeMarkAllNotificationsReadUseCase(notificationInboxRepository),
    push: makeManageDevicePushUseCase(devicePushService),
  }), [notificationInboxRepository, devicePushService]);

  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState<DevicePushStatus>('unsupported');
  const [pushBusy, setPushBusy] = useState(false);
  const [panel, attachPanel] = useState<HTMLDivElement | null>(null);

  const userId = user?.id ?? '';
  const tenantId = currentTenant?.id ?? '';

  useEffect(() => {
    if (!userId || !tenantId) return;
    const stopInbox = uc.subscribeInbox.execute(tenantId, userId, NOTIFICATION_INBOX_PAGE_SIZE, setNotifications);
    const stopUnread = uc.subscribeUnread.execute(tenantId, userId, NOTIFICATION_UNREAD_CAP, setUnreadCount);
    return () => {
      stopInbox();
      stopUnread();
    };
  }, [uc, userId, tenantId]);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    uc.push.status(userId)
      .then((status) => { if (!cancelled) setPushStatus(status); })
      .catch(() => { if (!cancelled) setPushStatus('unsupported'); });
    return () => { cancelled = true; };
  }, [open, userId, uc]);

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

  const items = useMemo<NotificationBellItem[]>(
    () => notifications.map((notification) => ({
      id: notification.id,
      title: label(notification.title, notification.params),
      message: label(notification.message, notification.params),
      when: formatDateTime(notification.createdAt),
      read: notification.read,
      hasLink: notification.link !== '' || notification.target !== null,
    })),
    [notifications, label, formatDateTime],
  );

  const toggle = useCallback(() => setOpen((current) => !current), []);

  const openItem = useCallback((id: string) => {
    const notification = notifications.find((one) => one.id === id);
    if (!notification || !tenantId) return;
    if (!notification.read) uc.markRead.execute(tenantId, [id]).catch(() => undefined);
    const tabKey = notification.target ? recordLinkTabKey(notification.target) : notification.link;
    if (tabKey) {
      setOpen(false);
      openLink(tabKey);
    }
  }, [notifications, tenantId, uc, openLink]);

  const seeAll = useCallback(() => {
    setOpen(false);
    openTab(NOTIFICATIONS_PAGE_KEY);
  }, [openTab]);

  const markAllRead = useCallback(() => {
    if (!tenantId || !userId) return;
    uc.markAllRead.execute(tenantId, userId).catch(() => notify(label('@core.automation/notifications.bell.mark-failed'), 'error'));
  }, [tenantId, userId, uc, notify, label]);

  const changePush = useCallback((enable: boolean) => {
    if (!userId) return;
    setPushBusy(true);
    (enable ? uc.push.enable(userId) : uc.push.disable(userId))
      .then((status) => {
        setPushStatus(status);
        if (enable && status === 'denied') notify(label('@core.automation/notifications.push.denied'), 'warning');
      })
      .catch(() => notify(label('@core.automation/notifications.push.failed'), 'error'))
      .finally(() => setPushBusy(false));
  }, [userId, uc, notify, label]);

  const enablePush = useCallback(() => changePush(true), [changePush]);
  const disablePush = useCallback(() => changePush(false), [changePush]);

  return {
    visible: Boolean(userId && tenantId),
    open,
    items,
    unreadCount,
    unreadLabel: unreadCount >= NOTIFICATION_UNREAD_CAP ? `${NOTIFICATION_UNREAD_CAP}+` : String(unreadCount),
    pushStatus,
    pushBusy,
    attachPanel,
    toggle,
    openItem,
    markAllRead,
    seeAll,
    enablePush,
    disablePush,
  };
};
