// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/notifications.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/notifications.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SettingsProperty } from './settings';

/**
 * Os destinos do passo `notify`. `audit` é o do escritório — uma entrada na Auditoria, sem
 * destinatário —; os outros três são PESSOAIS: chegam a cada destinatário, e cada pessoa decide em
 * Configurações quais deles a alcançam.
 *
 * As chaves são camelCase porque também são o caminho das saídas do passo
 * (`output.<passo>.delivered.inApp`): um hífen ali seria lido como subtração pela expressão.
 */
export const NOTIFICATION_CHANNELS = ['audit', 'inApp', 'email', 'push'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type PersonalNotificationChannel = Exclude<NotificationChannel, 'audit'>;

export const PERSONAL_NOTIFICATION_CHANNELS: readonly PersonalNotificationChannel[] = ['inApp', 'email', 'push'];

/** As notificações no sino: `tenants/{tid}/notification_inbox/{id}`, uma por destinatário. */
export const NOTIFICATION_INBOX_COLLECTION = 'notification_inbox';

/** Os navegadores que aceitaram push: `users/{uid}/push_subscriptions/{id}` — o aparelho é da pessoa. */
export const PUSH_SUBSCRIPTIONS_COLLECTION = 'push_subscriptions';

/** A credencial de e-mail do escritório: `tenants/{tid}/secrets/notification-email`, só o servidor lê. */
export const NOTIFICATION_EMAIL_SECRET_ID = 'notification-email';

/** O sino guarda o recente, não o histórico — o histórico é a Auditoria. `expiresAt` é TTL do Firestore. */
export const NOTIFICATION_INBOX_RETENTION_DAYS = 90;

/** Quantas notificações o sino mostra, e o teto da contagem de não lidas. */
export const NOTIFICATION_INBOX_PAGE_SIZE = 30;
export const NOTIFICATION_UNREAD_CAP = 99;

/**
 * Teto de destinatários por execução. Uma permissão concedida ao escritório inteiro alcança todos os
 * membros, e o envio é síncrono no passo: sem teto, um fluxo mal configurado viraria uma rajada.
 */
export const NOTIFICATION_MAX_RECIPIENTS = 200;

export const NOTIFICATION_TITLE_MAX_LENGTH = 200;
export const NOTIFICATION_MESSAGE_MAX_LENGTH = 4000;

export const notificationChannelSettingKey = (channel: PersonalNotificationChannel): string =>
  `notifications.${channel}`;

const CHANNEL_LABELS: Record<PersonalNotificationChannel, { label: string; description: string }> = {
  inApp: {
    label: '@core.automation/notifications.settings.in-app',
    description: '@core.automation/notifications.settings.in-app.description',
  },
  email: {
    label: '@core.automation/notifications.settings.email',
    description: '@core.automation/notifications.settings.email.description',
  },
  push: {
    label: '@core.automation/notifications.settings.push',
    description: '@core.automation/notifications.settings.push.description',
  },
};

const channelProperty = (channel: PersonalNotificationChannel): SettingsProperty => ({
  key: notificationChannelSettingKey(channel),
  ...CHANNEL_LABELS[channel],
  type: 'boolean',
  default: true,
  scopes: ['tenant', 'user'],
});

/**
 * A preferência por canal. A MESMA declaração alimenta a tela de Configurações e a decisão do
 * servidor (`resolveSetting`), então o padrão que a tela mostra é o que o envio aplica.
 *
 * O padrão é `true`: quem escolheu o canal foi quem escreveu a automação, e a pessoa recusa — não o
 * contrário. O escritório pode inverter o padrão para todos no escopo `tenant`.
 */
export const NOTIFICATION_SETTINGS_PROPERTIES: readonly SettingsProperty[] =
  PERSONAL_NOTIFICATION_CHANNELS.map(channelProperty);

export const notificationChannelProperty = (channel: PersonalNotificationChannel): SettingsProperty =>
  NOTIFICATION_SETTINGS_PROPERTIES.find((property) => property.key === notificationChannelSettingKey(channel))
  ?? channelProperty(channel);

/**
 * O documento do sino. Título e mensagem ficam como o passo os recebeu — referência de mensagem ou
 * texto do escritório — e são resolvidos na TELA, no idioma de quem lê; é por isso que não há um
 * idioma gravado aqui.
 */
export interface InboxNotificationDocument {
  recipientId: string;
  title: string;
  message: string;
  params: Record<string, string>;
  /** A aba que o clique abre — a mesma chave de um deeplink. Vazio quando não há o que abrir. */
  link: string;
  read: boolean;
  createdAt: Date;
  readAt: Date | null;
  expiresAt: Date;
  workflowId: string;
  executionId: string;
}

/** O que um navegador entrega ao aceitar push — o `PushSubscription.toJSON()` do padrão. */
export interface WebPushSubscriptionDocument {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string;
  createdAt: Date;
}

/** O que viaja dentro do push, e que o service worker desenha. Já traduzido para quem recebe. */
export interface WebPushPayload {
  title: string;
  body: string;
  link: string;
  tenantId: string;
  tag: string;
}

/**
 * A credencial SMTP do escritório. A senha nunca volta ao navegador: quem lê a configuração recebe
 * `NotificationEmailSettingsView`, que diz SE há senha, não qual.
 */
export interface NotificationEmailSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromAddress: string;
  fromName: string;
  /** O endereço da aplicação, para o link do e-mail. Carimbado por quem salvou, a partir do navegador. */
  appUrl: string;
}

export interface NotificationEmailSettingsView extends NotificationEmailSettings {
  configured: boolean;
  hasPassword: boolean;
}

export const EMPTY_NOTIFICATION_EMAIL_SETTINGS: NotificationEmailSettings = {
  host: '',
  port: 587,
  secure: false,
  username: '',
  fromAddress: '',
  fromName: '',
  appUrl: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmailAddress = (value: string): boolean => EMAIL_PATTERN.test(value.trim());

/**
 * O que está errado numa credencial, como referência de mensagem. A MESMA conferência roda no
 * formulário e na callable: o servidor não confia no que a tela já conferiu.
 */
export const notificationEmailSettingsIssue = (settings: NotificationEmailSettings): string | null => {
  if (!settings.host.trim()) return '@core.automation/notifications.email.issue.host';
  if (!Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535) {
    return '@core.automation/notifications.email.issue.port';
  }
  if (!isEmailAddress(settings.fromAddress)) return '@core.automation/notifications.email.issue.from';
  if (settings.appUrl && !/^https?:\/\/[^\s]+$/.test(settings.appUrl)) {
    return '@core.automation/notifications.email.issue.app-url';
  }
  return null;
};

const MEMBER_ID_FIELDS = ['memberId', 'userId', 'uid'] as const;

const candidateOf = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  for (const field of MEMBER_ID_FIELDS) {
    const id = record[field];
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return typeof record.id === 'string' && record.id.trim() ? record.id.trim() : null;
};

/**
 * Os ids de MEMBRO que um valor qualquer nomeia — o de um campo do registro, uma lista, a saída de
 * outro passo.
 *
 * Um texto é o próprio uid. Um registro (o que a hidratação põe no lugar de uma referência) nomeia o
 * membro pelo campo que o liga a um — `memberId`, `userId` ou `uid` —, e só na falta deles pelo
 * próprio `id`, que é o caso de uma referência a `members`. O kernel não conhece a coleção do outro
 * lado: quem decide se o candidato é mesmo membro é o servidor, conferindo no escritório. Por isso um
 * registro sem vínculo nenhum só produz um candidato que não passa.
 */
export const notificationRecipientCandidates = (value: unknown): string[] => {
  const items = Array.isArray(value) ? value : [value];
  const ids = new Set<string>();
  for (const item of items) {
    const id = candidateOf(item);
    if (id) ids.add(id);
  }
  return [...ids];
};

const PRIVATE_HOST = /^(localhost|metadata(\.google\.internal)?|.*\.(internal|local|localhost)|\d{1,3}(\.\d{1,3}){3}|\[.*\])$/i;

/**
 * Se o servidor pode fazer o POST de push para este endereço. A regra do Firestore já exige
 * `https`; aqui a conferência vai além, porque é o SERVIDOR que chama: um endereço interno ou um IP
 * cru transformaria a inscrição numa forma de pôr a function para falar com a rede de dentro.
 */
export const isPushEndpointAllowed = (endpoint: string): boolean => {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !url.port && !PRIVATE_HOST.test(url.hostname);
  } catch {
    return false;
  }
};

/** `true` só para o booleano ou o texto que diz sim — o `RunModal` transporta tudo como texto. */
export const isChannelEnabled = (value: unknown): boolean => value === true || value === 'true';
