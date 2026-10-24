import type { DevicePushStatus, InboxNotification, InboxNotificationFilter } from '../entities/InboxNotification';
import type { NotificationEmailSettings, NotificationEmailSettingsView } from '../schema/notifications';

export interface INotificationInboxRepository {
  subscribeRecent(
    tenantId: string,
    userId: string,
    max: number,
    onChange: (notifications: InboxNotification[]) => void,
  ): () => void;
  subscribeUnreadCount(tenantId: string, userId: string, cap: number, onChange: (count: number) => void): () => void;
  /** A página: até `max` avisos do filtro, ao vivo. "Carregar mais" é pedir de novo com `max` maior. */
  subscribeFiltered(
    tenantId: string,
    userId: string,
    filter: InboxNotificationFilter,
    max: number,
    onChange: (notifications: InboxNotification[]) => void,
    onError: () => void,
  ): () => void;
  /**
   * Os avisos ao PORTAL da pessoa — o sino do convidado. A consulta filtra pelo destinatário E pelo
   * portal, que é o que a regra exige de quem não é membro.
   */
  subscribePortal(
    tenantId: string,
    userId: string,
    max: number,
    onChange: (notifications: InboxNotification[]) => void,
  ): () => void;
  markRead(tenantId: string, ids: readonly string[]): Promise<void>;
  markUnread(tenantId: string, ids: readonly string[]): Promise<void>;
  markAllRead(tenantId: string, userId: string): Promise<void>;
}

/** O push NESTE navegador: o aparelho é da pessoa, e por isso a inscrição não leva escritório. */
export interface IDevicePushService {
  status(userId: string): Promise<DevicePushStatus>;
  enable(userId: string): Promise<DevicePushStatus>;
  disable(userId: string): Promise<DevicePushStatus>;
}

export interface INotificationEmailService {
  get(tenantId: string): Promise<NotificationEmailSettingsView>;
  /** `password` vazio mantém a gravada — ela nunca volta do servidor para ser reenviada. */
  save(tenantId: string, settings: NotificationEmailSettings, password: string): Promise<NotificationEmailSettingsView>;
  clear(tenantId: string): Promise<NotificationEmailSettingsView>;
  sendTest(tenantId: string): Promise<string>;
}
