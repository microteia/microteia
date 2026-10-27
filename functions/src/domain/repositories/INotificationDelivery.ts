import type {
  InboxNotificationDocument,
  NotificationEmailSettings,
  NotificationMutes,
  PersonalNotificationChannel,
  WebPushPayload,
} from '../schema/notifications';
import type { NotificationEmailLayout, NotificationTemplates } from '../schema/notificationTemplate';
import type { ContactChannel, NotificationSmsSettings } from '../schema/notificationContacts';

/** Um destinatário já conferido: é membro do escritório, e as preferências e o idioma são os dele. */
export interface NotificationRecipient {
  userId: string;
  email: string;
  locale: string;
  channels: Record<PersonalNotificationChannel, boolean>;
  /** Os canais que a pessoa silenciou, por tipo de aviso. */
  mutes: NotificationMutes;
  /**
   * O link de descadastro, quando o destinatário é um ENDEREÇO lido de um campo de contato — ele não
   * tem conta nem Configurações onde recusar o canal, e o e-mail é o único lugar em que pode dizer não.
   */
  optOutUrl?: string;
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
  /** O idioma do escritório — o de quem não tem conta, e por isso não tem preferência. */
  officeLocale(tenantId: string): Promise<string>;
}

/** Um endereço lido de um campo de contato, já normalizado (e-mail em minúsculas, telefone em E.164). */
export interface ContactAddress {
  channel: ContactChannel;
  address: string;
}

/** O endereço com o BILHETE do descadastro e o que a pessoa decidiu sobre ele. */
export interface ContactState extends ContactAddress {
  ticket: string;
  optedOut: boolean;
}

/**
 * Os endereços a que o escritório já escreveu, e os que pediram para não receber mais. O bilhete é
 * derivado do endereço com um segredo da instalação: o link de descadastro não carrega o endereço, e
 * ninguém descadastra outra pessoa calculando o bilhete dela.
 */
export interface INotificationContactLog {
  status(tenantId: string, addresses: readonly ContactAddress[]): Promise<ContactState[]>;
  /** Grava ANTES do envio que o endereço foi escrito — é o que faz o link do e-mail funcionar. */
  touch(tenantId: string, contacts: readonly ContactState[], at: Date): Promise<void>;
  find(tenantId: string, ticket: string): Promise<ContactState | null>;
  setOptedOut(tenantId: string, ticket: string, optedOut: boolean, at: Date): Promise<void>;
}

export interface NotificationSmsCredential {
  settings: NotificationSmsSettings;
  /** O token da Twilio, ou o que o webhook recebe em `Authorization: Bearer`. */
  secret: string;
}

export interface INotificationSmsConfigRepository {
  get(tenantId: string): Promise<NotificationSmsCredential | null>;
  /** `secret: null` mantém o gravado — o formulário nunca o recebe de volta para reenviar. */
  save(tenantId: string, settings: NotificationSmsSettings, secret: string | null, userId: string): Promise<void>;
  clear(tenantId: string): Promise<void>;
}

export interface SmsSession {
  send(to: string, body: string): Promise<void>;
}

export interface ISmsTransport {
  open(credential: NotificationSmsCredential): SmsSession;
  /** Confere a credencial no provedor SEM mandar mensagem a ninguém — o teste da tela de configuração. */
  verify(credential: NotificationSmsCredential): Promise<void>;
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
  /** Vai no cabeçalho `List-Unsubscribe`, para o cliente de e-mail oferecer o descadastro. */
  unsubscribeUrl?: string;
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
