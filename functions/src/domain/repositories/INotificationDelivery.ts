import type {
  InboxNotificationDocument,
  NotificationEmailSettings,
  NotificationMutes,
  PersonalNotificationChannel,
  WebPushPayload,
} from '../schema/notifications';
import type { NotificationEmailLayout, NotificationTemplates } from '../schema/notificationTemplate';

/** Um destinatário já conferido: é membro do escritório, e as preferências e o idioma são os dele. */
export interface NotificationRecipient {
  userId: string;
  email: string;
  locale: string;
  channels: Record<PersonalNotificationChannel, boolean>;
  /** Os canais que a pessoa silenciou, por tipo de aviso. */
  mutes: NotificationMutes;
}

/**
 * Quem pode receber. É a ÚNICA porta pela qual um id vira destinatário: o que não é membro do
 * escritório fica de fora aqui, venha de onde vier — de um campo do registro, de uma expressão, da
 * saída de outro passo.
 */
/** Um convidado do portal que vê o registro AGORA — o convite conferido, não o `audience` da projeção. */
export interface PortalGuestContact {
  userId: string;
  email: string;
  /** O idioma do convite. Ausente, vale o do escritório. */
  locale?: string;
}

export interface INotificationDirectory {
  recipients(tenantId: string, userIds: readonly string[]): Promise<NotificationRecipient[]>;
  /**
   * Os convidados como destinatários. O convidado não tem preferências próprias: valem os padrões de
   * canal do ESCRITÓRIO. Push não existe para ele — o portal não tem onde ativá-lo.
   */
  guests(tenantId: string, contacts: readonly PortalGuestContact[]): Promise<NotificationRecipient[]>;
  /** Os membros com a permissão, ou com o curinga do dono — a mesma pergunta das Security Rules. */
  memberIdsGranting(tenantId: string, permission: string, limit: number): Promise<string[]>;
}

/** O que o escritório escolheu para a cara dos avisos — ver `notificationTemplate.ts`. */
export interface INotificationAppearance {
  get(tenantId: string): Promise<{ layout: NotificationEmailLayout; templates: NotificationTemplates; logoURL: string | null }>;
}

/** As marcas de despacho já feito. `claim` devolve `false` quando a chave já foi usada. */
export interface INotificationDispatchLog {
  claim(tenantId: string, dispatchId: string, expiresAt: Date): Promise<boolean>;
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
