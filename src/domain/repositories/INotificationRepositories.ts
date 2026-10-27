import type { DevicePushStatus, InboxNotification, InboxNotificationFilter } from '../entities/InboxNotification';
import type { NotificationEmailSettings, NotificationEmailSettingsView } from '../schema/notifications';
import type { ContactChannel, NotificationSmsSettings, NotificationSmsSettingsView } from '../schema/notificationContacts';

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

export interface INotificationSmsService {
  get(tenantId: string): Promise<NotificationSmsSettingsView>;
  /** `secret` vazio mantém o gravado — ele nunca volta do servidor para ser reenviado. */
  save(tenantId: string, settings: NotificationSmsSettings, secret: string): Promise<NotificationSmsSettingsView>;
  clear(tenantId: string): Promise<NotificationSmsSettingsView>;
  /** Confere a credencial no provedor, sem mandar mensagem. */
  verify(tenantId: string): Promise<void>;
}

/** O que a página de descadastro mostra: o endereço vem MASCARADO do servidor. */
export interface NotificationOptOutState {
  tenant: string;
  channel: ContactChannel;
  address: string;
  optedOut: boolean;
}

/** O descadastro de quem recebe avisos num endereço — sem sessão, só com o bilhete do link. */
export interface INotificationOptOutService {
  run(tenantId: string, ticket: string, op: 'get' | 'opt-out' | 'opt-in'): Promise<NotificationOptOutState>;
}
