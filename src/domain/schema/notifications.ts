// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/notifications.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SettingsProperty } from './settings';
import type { ExtensionPointDefinition } from './plugin/extensionPoint';
import type { Contribution } from './plugin/contribution';
import type { RecordLinkTarget } from './recordLink';

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
export const NOTIFICATION_INBOX_RETENTION_DAYS = 30;

/**
 * A marca de um despacho JÁ feito: `tenants/{tid}/notification_dispatches/{chave}`. Quem pede com
 * `dedupKey` não avisa duas vezes — uma automação reexecutada, um gatilho repetido. Só o servidor a
 * lê e grava, e ela vence pelo mesmo TTL do sino.
 */
export const NOTIFICATION_DISPATCHES_COLLECTION = 'notification_dispatches';

/** Id de documento a partir de uma chave qualquer: o Firestore não aceita `/`, e a chave é livre. */
export const notificationDedupDocId = (dedupKey: string): string => {
  let first = 0x811c9dc5;
  let second = 0x01000193;
  for (let index = 0; index < dedupKey.length; index += 1) {
    const code = dedupKey.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x5bd1e995) >>> 0;
  }
  return `${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
};

/** A aba da página de notificações — aberta pelo "Ver todas" do sino. */
export const NOTIFICATIONS_PAGE_KEY = 'notifications';

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

/**
 * O que cada pessoa SILENCIOU, por tipo de aviso: `{ "<tipo>": ["email", "push"] }`. Mora nas
 * preferências da pessoa (`settings/user_<uid>`), e quem a edita é a página de avisos — não a seção
 * de Configurações, que mostraria um JSON cru.
 */
export const NOTIFICATION_MUTED_SETTING_KEY = 'notifications.muted';

export type NotificationMutes = Record<string, PersonalNotificationChannel[]>;

/** O valor gravado, lido com desconfiança: o que não é canal conhecido some. */
export const asNotificationMutes = (value: unknown): NotificationMutes => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const mutes: NotificationMutes = {};
  for (const [category, channels] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(channels)) continue;
    const known = PERSONAL_NOTIFICATION_CHANNELS.filter((channel) => channels.includes(channel));
    if (known.length > 0) mutes[category] = known;
  }
  return mutes;
};

export const isNotificationMuted = (
  mutes: NotificationMutes,
  category: string,
  channel: PersonalNotificationChannel,
): boolean => !!category && (mutes[category] ?? []).includes(channel);

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
  /**
   * O registro de que o aviso fala. O clique o abre pela tela que descreve a coleção, na hora — como
   * a Auditoria —, e por isso não grava chave de aba nenhuma. Vence `link` quando os dois existem.
   */
  target: RecordLinkTarget | null;
  /** O TIPO do aviso (`<plugin>/<chave>`), declarado em `notification.category`. Vazio = sem tipo. */
  category: string;
  /** Quem avisou: `workflow`, ou o módulo do kernel (`core.tenant/portal`). */
  source: string;
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

/**
 * O TIPO de um aviso — "atividade do portal", "prazo próximo". Quem notifica declara os seus, e cada
 * pessoa decide, por tipo, por quais canais quer recebê-los. O kernel não conhece nenhum tipo de
 * negócio: os dele são os dos próprios módulos (o portal), e o resto vem das extensões.
 */
export const NOTIFICATION_CATEGORY_POINT = 'notification.category';

export const NOTIFICATION_API_VERSION = '1.0.0';

export interface NotificationCategoryMetadata {
  /** A chave, única no pacote. O tipo gravado no aviso é `<plugin>/<chave>`. */
  key: string;
  /** Referência de mensagem (`@ns/chave`). */
  title: string;
  description?: string;
  /** Do conjunto curado de ícones de tela. */
  icon?: string;
  /**
   * As variáveis que os avisos deste tipo trazem (`guest`, `record`) — o que o escritório pode usar
   * nos modelos (`{guest}`), além de `title`, `message` e `tenant`, que todo aviso tem.
   */
  variables?: string[];
}

export const NOTIFICATION_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: NOTIFICATION_CATEGORY_POINT,
    apiVersion: NOTIFICATION_API_VERSION,
    title: '@core.automation/point.notification-category',
    description: '@core.automation/point.notification-category.description',
    ownerPluginId: 'core.automation',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
];

const CATEGORY_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;

/** A metadata lida com desconfiança. Malformada é ausente: o aviso continua, só sem tipo na tela. */
export const asNotificationCategory = (metadata: unknown): NotificationCategoryMetadata | null => {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = metadata as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);
  const key = text(raw.key);
  const title = text(raw.title);
  if (!key || !CATEGORY_KEY_PATTERN.test(key) || !title) return null;
  return {
    key,
    title,
    ...(text(raw.description) ? { description: text(raw.description) } : {}),
    ...(text(raw.icon) ? { icon: text(raw.icon) } : {}),
    ...(Array.isArray(raw.variables)
      ? { variables: [...new Set(raw.variables.filter((one): one is string => typeof one === 'string' && /^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(one)))] }
      : {}),
  };
};

/** O tipo como o aviso o grava: `<plugin>/<chave>`. */
export const notificationCategoryId = (pluginId: string, key: string): string => `${pluginId}/${key}`;

export const notificationCategoryContribution = (metadata: NotificationCategoryMetadata): Contribution => ({
  point: NOTIFICATION_CATEGORY_POINT,
  id: `notification-category.${metadata.key}`,
  apiVersion: NOTIFICATION_API_VERSION,
  metadata: metadata as unknown as Record<string, unknown>,
});
