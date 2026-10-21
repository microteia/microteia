import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDI } from '../../../infrastructure/di/useDI';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useSettings } from '../../../stores/useSettings';
import { useNotification } from '../../../stores/useNotification';
import { useOptionalLocale } from '../../../stores/useLocale';
import { useLabel, useLocaleFormat, useT } from '../../shared/i18n/useT';
import { useOpenLink } from '../../shared/useOpenLink';
import { usePointContributions } from '../../shared/extensions/usePointContributions';
import type { DevicePushStatus, InboxNotification } from '../../../domain/entities/InboxNotification';
import {
  asNotificationCategory,
  asNotificationMutes,
  NOTIFICATION_CATEGORY_POINT,
  NOTIFICATION_INBOX_PAGE_SIZE,
  NOTIFICATION_INBOX_RETENTION_DAYS,
  NOTIFICATION_MUTED_SETTING_KEY,
  NOTIFICATION_UNREAD_CAP,
  notificationCategoryId,
  notificationChannelProperty,
  PERSONAL_NOTIFICATION_CHANNELS,
  type NotificationMutes,
  type PersonalNotificationChannel,
} from '../../../domain/schema/notifications';
import { resolveSetting } from '../../../domain/schema/settings';
import { recordLinkTabKey } from '../../../domain/schema/recordLink';
import { makeSubscribeToFilteredNotificationsUseCase } from '../../../domain/usecases/notifications/SubscribeToFilteredNotificationsUseCase';
import { makeSubscribeToUnreadNotificationsUseCase } from '../../../domain/usecases/notifications/SubscribeToUnreadNotificationsUseCase';
import { makeMarkNotificationsReadUseCase } from '../../../domain/usecases/notifications/MarkNotificationsReadUseCase';
import { makeMarkNotificationsUnreadUseCase } from '../../../domain/usecases/notifications/MarkNotificationsUnreadUseCase';
import { makeMarkAllNotificationsReadUseCase } from '../../../domain/usecases/notifications/MarkAllNotificationsReadUseCase';
import { makeManageDevicePushUseCase } from '../../../domain/usecases/notifications/ManageDevicePushUseCase';

export type NotificationsTab = 'inbox' | 'preferences';

/** Um tipo de aviso declarado — por extensão ou pelo kernel —, já traduzido. */
export interface NotificationCategoryView {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface NotificationItemView {
  id: string;
  title: string;
  message: string;
  time: string;
  typeLabel: string;
  icon: string;
  read: boolean;
  canOpen: boolean;
}

export interface NotificationDayGroup {
  key: string;
  label: string;
  items: NotificationItemView[];
}

export interface NotificationChannelToggle {
  channel: PersonalNotificationChannel;
  label: string;
  on: boolean;
  /** Desligado para TODOS os tipos em Configurações: o tipo não muda nada aqui. */
  globallyOff: boolean;
}

export interface NotificationPreferenceRow extends NotificationCategoryView {
  channels: NotificationChannelToggle[];
}

export interface NotificationsViewModel {
  tab: NotificationsTab;
  setTab: (tab: NotificationsTab) => void;
  subtitle: string;
  unreadLabel: string;
  hasUnread: boolean;
  unreadOnly: boolean;
  setUnreadOnly: (unreadOnly: boolean) => void;
  /** `null` = todos os tipos; `''` = os gerais. */
  category: string | null;
  setCategory: (category: string | null) => void;
  typeFilters: Array<{ id: string | null; label: string }>;
  groups: NotificationDayGroup[];
  loading: boolean;
  failed: boolean;
  canLoadMore: boolean;
  loadMore: () => void;
  open: (id: string) => void;
  toggleRead: (id: string) => void;
  markAllRead: () => void;
  preferences: NotificationPreferenceRow[];
  togglePreference: (categoryId: string, channel: PersonalNotificationChannel) => void;
  pushStatus: DevicePushStatus;
  pushBusy: boolean;
  enablePush: () => void;
  disablePush: () => void;
}

const CHANNEL_LABELS: Record<PersonalNotificationChannel, string> = {
  inApp: 'notifications.page.preferences.channel.in-app',
  email: 'notifications.page.preferences.channel.email',
  push: 'notifications.page.preferences.channel.push',
};

const DEFAULT_ICON = 'notification';

const dayKeyOf = (date: Date): string => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export const useNotificationsViewModel = (): NotificationsViewModel => {
  const { notificationInboxRepository, devicePushService } = useDI();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { values, setValue } = useSettings();
  const { notify } = useNotification();
  const { locale } = useOptionalLocale();
  const t = useT('core.automation');
  const label = useLabel();
  const { formatLongDate } = useLocaleFormat();
  const openLink = useOpenLink();
  const contributions = usePointContributions(NOTIFICATION_CATEGORY_POINT);

  const uc = useMemo(() => ({
    subscribe: makeSubscribeToFilteredNotificationsUseCase(notificationInboxRepository),
    subscribeUnread: makeSubscribeToUnreadNotificationsUseCase(notificationInboxRepository),
    markRead: makeMarkNotificationsReadUseCase(notificationInboxRepository),
    markUnread: makeMarkNotificationsUnreadUseCase(notificationInboxRepository),
    markAllRead: makeMarkAllNotificationsReadUseCase(notificationInboxRepository),
    push: makeManageDevicePushUseCase(devicePushService),
  }), [notificationInboxRepository, devicePushService]);

  const userId = user?.id ?? '';
  const tenantId = currentTenant?.id ?? '';

  const [tab, setTab] = useState<NotificationsTab>('inbox');
  const [unreadOnly, setUnreadOnlyState] = useState(false);
  const [category, setCategoryState] = useState<string | null>(null);
  const [max, setMax] = useState(NOTIFICATION_INBOX_PAGE_SIZE);
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [failedKey, setFailedKey] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushStatus, setPushStatus] = useState<DevicePushStatus>('unsupported');
  const [pushBusy, setPushBusy] = useState(false);

  // A chave do pedido: o que chegou para outro filtro não conta como carregado para este.
  const requestKey = `${tenantId}|${userId}|${unreadOnly}|${category ?? '*'}|${max}`;

  useEffect(() => {
    if (!userId || !tenantId) return;
    return uc.subscribe.execute(
      tenantId,
      userId,
      { unreadOnly, category },
      max,
      (next) => {
        setNotifications(next);
        setLoadedKey(requestKey);
        setFailedKey('');
      },
      () => setFailedKey(requestKey),
    );
  }, [uc, tenantId, userId, unreadOnly, category, max, requestKey]);

  useEffect(() => {
    if (!userId || !tenantId) return;
    return uc.subscribeUnread.execute(tenantId, userId, NOTIFICATION_UNREAD_CAP, setUnreadCount);
  }, [uc, tenantId, userId]);

  useEffect(() => {
    if (tab !== 'preferences' || !userId) return;
    let cancelled = false;
    uc.push.status(userId)
      .then((status) => { if (!cancelled) setPushStatus(status); })
      .catch(() => { if (!cancelled) setPushStatus('unsupported'); });
    return () => { cancelled = true; };
  }, [tab, userId, uc]);

  const categories = useMemo<NotificationCategoryView[]>(
    () => contributions.flatMap((contribution) => {
      const metadata = asNotificationCategory(contribution.metadata);
      return metadata
        ? [{
          id: notificationCategoryId(contribution.pluginId, metadata.key),
          title: label(metadata.title),
          description: metadata.description ? label(metadata.description) : '',
          icon: metadata.icon ?? DEFAULT_ICON,
        }]
        : [];
    }),
    [contributions, label],
  );

  const timeFormat = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale]);

  const groups = useMemo<NotificationDayGroup[]>(() => {
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const byDay = new Map<string, NotificationDayGroup>();
    for (const notification of notifications) {
      const key = dayKeyOf(notification.createdAt);
      let group = byDay.get(key);
      if (!group) {
        const dayLabel = key === dayKeyOf(today)
          ? t('notifications.page.today')
          : key === dayKeyOf(yesterday) ? t('notifications.page.yesterday') : formatLongDate(notification.createdAt);
        group = { key, label: dayLabel, items: [] };
        byDay.set(key, group);
      }
      const type = categories.find((one) => one.id === notification.category);
      group.items.push({
        id: notification.id,
        title: label(notification.title, notification.params),
        message: label(notification.message, notification.params),
        time: timeFormat.format(notification.createdAt),
        typeLabel: type?.title ?? t('notifications.page.category.none'),
        icon: type?.icon ?? DEFAULT_ICON,
        read: notification.read,
        canOpen: notification.target !== null || notification.link !== '',
      });
    }
    return [...byDay.values()];
  }, [notifications, categories, label, t, formatLongDate, timeFormat]);

  const setUnreadOnly = useCallback((next: boolean) => {
    setUnreadOnlyState(next);
    setMax(NOTIFICATION_INBOX_PAGE_SIZE);
  }, []);

  const setCategory = useCallback((next: string | null) => {
    setCategoryState(next);
    setMax(NOTIFICATION_INBOX_PAGE_SIZE);
  }, []);

  const loadMore = useCallback(() => setMax((current) => current + NOTIFICATION_INBOX_PAGE_SIZE), []);

  const open = useCallback((id: string) => {
    const notification = notifications.find((one) => one.id === id);
    if (!notification || !tenantId) return;
    if (!notification.read) uc.markRead.execute(tenantId, [id]).catch(() => undefined);
    const tabKey = notification.target ? recordLinkTabKey(notification.target) : notification.link;
    if (tabKey) openLink(tabKey);
  }, [notifications, tenantId, uc, openLink]);

  const toggleRead = useCallback((id: string) => {
    const notification = notifications.find((one) => one.id === id);
    if (!notification || !tenantId) return;
    const change = notification.read ? uc.markUnread : uc.markRead;
    change.execute(tenantId, [id]).catch(() => notify(t('notifications.bell.mark-failed'), 'error'));
  }, [notifications, tenantId, uc, notify, t]);

  const markAllRead = useCallback(() => {
    if (!tenantId || !userId) return;
    uc.markAllRead.execute(tenantId, userId).catch(() => notify(t('notifications.bell.mark-failed'), 'error'));
  }, [tenantId, userId, uc, notify, t]);

  const mutes = useMemo<NotificationMutes>(() => asNotificationMutes(values.user[NOTIFICATION_MUTED_SETTING_KEY]), [values.user]);

  const globallyOn = useMemo(() => Object.fromEntries(PERSONAL_NOTIFICATION_CHANNELS.map((channel) => [
    channel,
    resolveSetting(notificationChannelProperty(channel), values).value === true,
  ])) as Record<PersonalNotificationChannel, boolean>, [values]);

  const preferences = useMemo<NotificationPreferenceRow[]>(() => categories.map((one) => ({
    ...one,
    channels: PERSONAL_NOTIFICATION_CHANNELS.map((channel) => ({
      channel,
      label: t(CHANNEL_LABELS[channel]),
      on: !(mutes[one.id] ?? []).includes(channel),
      globallyOff: !globallyOn[channel],
    })),
  })), [categories, mutes, globallyOn, t]);

  const togglePreference = useCallback((categoryId: string, channel: PersonalNotificationChannel) => {
    const muted = mutes[categoryId] ?? [];
    const nextChannels = muted.includes(channel) ? muted.filter((one) => one !== channel) : [...muted, channel];
    const next: NotificationMutes = { ...mutes };
    if (nextChannels.length > 0) next[categoryId] = nextChannels;
    else delete next[categoryId];
    setValue('user', NOTIFICATION_MUTED_SETTING_KEY, next)
      .then(() => notify(t('notifications.page.preferences.saved'), 'success'))
      .catch(() => notify(t('notifications.page.preferences.failed'), 'error'));
  }, [mutes, setValue, notify, t]);

  const changePush = useCallback((enable: boolean) => {
    if (!userId) return;
    setPushBusy(true);
    (enable ? uc.push.enable(userId) : uc.push.disable(userId))
      .then((status) => {
        setPushStatus(status);
        if (enable && status === 'denied') notify(t('notifications.push.denied'), 'warning');
      })
      .catch(() => notify(t('notifications.push.failed'), 'error'))
      .finally(() => setPushBusy(false));
  }, [userId, uc, notify, t]);

  const enablePush = useCallback(() => changePush(true), [changePush]);
  const disablePush = useCallback(() => changePush(false), [changePush]);

  const typeFilters = useMemo(() => [
    { id: null, label: t('notifications.page.filter.type.all') },
    ...categories.map((one) => ({ id: one.id as string | null, label: one.title })),
    { id: '', label: t('notifications.page.category.none') },
  ], [categories, t]);

  return {
    tab,
    setTab,
    subtitle: t('notifications.page.subtitle', { days: String(NOTIFICATION_INBOX_RETENTION_DAYS) }),
    unreadLabel: t('notifications.page.unread-count', {
      count: unreadCount >= NOTIFICATION_UNREAD_CAP ? `${NOTIFICATION_UNREAD_CAP}+` : String(unreadCount),
    }),
    hasUnread: unreadCount > 0,
    unreadOnly,
    setUnreadOnly,
    category,
    setCategory,
    typeFilters,
    groups,
    loading: loadedKey !== requestKey && failedKey !== requestKey,
    failed: failedKey === requestKey,
    canLoadMore: notifications.length >= max,
    loadMore,
    open,
    toggleRead,
    markAllRead,
    preferences,
    togglePreference,
    pushStatus,
    pushBusy,
    enablePush,
    disablePush,
  };
};
