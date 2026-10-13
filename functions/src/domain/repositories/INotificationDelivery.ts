import type {
  InboxNotificationDocument,
  NotificationEmailSettings,
  PersonalNotificationChannel,
  WebPushPayload,
} from '../schema/notifications';

/** Um destinatário já conferido: é membro do escritório, e as preferências e o idioma são os dele. */
export interface NotificationRecipient {
  userId: string;
  email: string;
  locale: string;
  channels: Record<PersonalNotificationChannel, boolean>;
}

/**
 * Quem pode receber. É a ÚNICA porta pela qual um id vira destinatário: o que não é membro do
 * escritório fica de fora aqui, venha de onde vier — de um campo do registro, de uma expressão, da
 * saída de outro passo.
 */
export interface INotificationDirectory {
  recipients(tenantId: string, userIds: readonly string[]): Promise<NotificationRecipient[]>;
  /** Os membros com a permissão, ou com o curinga do dono — a mesma pergunta das Security Rules. */
  memberIdsGranting(tenantId: string, permission: string, limit: number): Promise<string[]>;
}

export interface INotificationInboxRepository {
  deliver(tenantId: string, notifications: readonly InboxNotificationDocument[]): Promise<void>;
}

export interface NotificationEmailCredential {
  settings: NotificationEmailSettings;
  password: string;
}

export interface INotificationEmailConfigRepository {
  get(tenantId: string): Promise<NotificationEmailCredential | null>;
  /** `password: null` mantém a senha gravada — o formulário nunca a recebe de volta para reenviar. */
  save(tenantId: string, settings: NotificationEmailSettings, password: string | null, userId: string): Promise<void>;
  clear(tenantId: string): Promise<void>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Uma conexão aberta com o servidor do escritório, reaproveitada por todos os destinatários da execução. */
export interface EmailSession {
  send(message: EmailMessage): Promise<void>;
  close(): void;
}

export interface IEmailTransport {
  open(credential: NotificationEmailCredential): EmailSession;
}

export interface IWebPushSender {
  /** Os ids que receberam em ao menos um aparelho. Inscrição vencida é removida no caminho. */
  send(payloads: ReadonlyMap<string, WebPushPayload>): Promise<{ delivered: Set<string>; failed: Set<string> }>;
}

/** Resolve título e mensagem no idioma de quem recebe — referência traduz, texto do escritório passa. */
export type NotificationTextResolver = (value: string, params: Record<string, string>) => string;

export interface INotificationTextCatalog {
  resolverFor(tenantId: string, locale: string): Promise<NotificationTextResolver>;
}
