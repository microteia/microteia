// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/notificationContacts.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { CustomFieldType } from './fieldRules';
import { isPublicHttpsEndpoint } from './notifications';

/**
 * O que um campo GUARDA, quando guarda um meio de falar com alguém: um e-mail ou um telefone.
 *
 * É declaração da TELA, e não do passo: o `notify` só escreve para um endereço lido de um campo que a
 * tela disse ser de contato. Sem isso, qualquer texto do registro — uma observação, um nome — viraria
 * destinatário de um e-mail que sai com a cara do escritório, e quem decide o que é contato é quem
 * desenhou o cadastro, não quem escreveu a automação.
 */
export const CONTACT_KINDS = ['email', 'phone'] as const;

export type ContactKind = (typeof CONTACT_KINDS)[number];

export const asContactKind = (value: unknown): ContactKind | undefined =>
  CONTACT_KINDS.find((kind) => kind === value);

/** O kernel a partir do qual o `notify` lê `recipientAddresses`/`recipientPhones` e o campo declara `contact`. */
export const CONTACT_NOTIFY_SINCE_KERNEL = '2.78.0';

/**
 * Os tipos de campo que podem guardar um contato: um texto de uma linha, com ou sem máscara. Lista,
 * referência e texto longo ficam de fora — o endereço é UM valor que a pessoa digita.
 */
export const CONTACT_FIELD_TYPES: readonly CustomFieldType[] = ['text', 'masked'];

export const fieldAcceptsContact = (type: CustomFieldType, multi?: boolean | null): boolean =>
  CONTACT_FIELD_TYPES.includes(type) && multi !== true;

/** Por onde cada tipo de contato é alcançado. São também os nomes das saídas do passo. */
export type ContactChannel = 'email' | 'sms';

export const CONTACT_CHANNEL_OF: Record<ContactKind, ContactChannel> = { email: 'email', phone: 'sms' };

/**
 * As marcas dos endereços já escritos: `tenants/{tid}/notification_contacts/{ticket}`. Só o servidor
 * lê e grava. O id é o BILHETE do descadastro — derivado do endereço por HMAC com segredo da
 * instalação —, e por isso o link do e-mail não carrega o endereço, e ninguém o forja a partir dele.
 */
export const NOTIFICATION_CONTACTS_COLLECTION = 'notification_contacts';

/** A credencial do provedor de SMS: `tenants/{tid}/secrets/notification-sms`, só o servidor lê. */
export const NOTIFICATION_SMS_SECRET_ID = 'notification-sms';

/** A página pública em que quem recebeu um aviso num endereço desiste de recebê-lo. */
export const NOTIFICATION_OPT_OUT_PATH = '/notifications/opt-out';

const TICKET_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;

export const isOptOutTicket = (value: unknown): value is string => typeof value === 'string' && TICKET_PATTERN.test(value);

export const notificationOptOutPath = (tenantId: string, ticket: string, locale?: string): string => {
  const path = `${NOTIFICATION_OPT_OUT_PATH}/${encodeURIComponent(tenantId)}/${encodeURIComponent(ticket)}`;
  return locale ? `${path}?locale=${encodeURIComponent(locale)}` : path;
};

/**
 * Os valores que um campo de contato trouxe. Um texto pode guardar mais de um endereço — "a@x.com;
 * b@y.com" é como um cadastro costuma recebê-los —, e o caminho que atravessa uma lista de registros
 * traz um valor por item.
 */
export const contactValues = (value: unknown): string[] => {
  const items = Array.isArray(value) ? value.flat(2) : [value];
  return items
    .filter((item): item is string | number => typeof item === 'string' || typeof item === 'number')
    .flatMap((item) => String(item).split(/[;,\n]+/))
    .map((item) => item.trim())
    .filter(Boolean);
};

const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;

/** O e-mail como é comparado e enviado: sem espaço, em minúsculas. Inválido é `null`. */
export const normalizeContactEmail = (value: string): string | null => {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
};

const COUNTRY_CODE_PATTERN = /^[1-9]\d{0,2}$/;

export const isCountryCode = (value: string): boolean => COUNTRY_CODE_PATTERN.test(value);

/**
 * O telefone em E.164 (`+5571999998888`), que é o que todo provedor aceita.
 *
 * O cadastro guarda o número como a pessoa o digitou — "(71) 99999-8888" —, sem país. Quem diz o país
 * é a configuração de SMS do escritório (`defaultCountryCode`), e o número que já vem com `+` ou `00`
 * traz o seu. O zero de longa distância nacional (`071…`) cai. Fora de 8 a 15 dígitos é `null`.
 */
export const normalizePhoneNumber = (value: string, defaultCountryCode: string): string | null => {
  const raw = value.trim();
  const digits = raw.replace(/\D+/g, '');
  if (!digits) return null;
  let international: string;
  if (raw.startsWith('+')) international = digits;
  else if (digits.startsWith('00')) international = digits.slice(2);
  else if (isCountryCode(defaultCountryCode)) international = `${defaultCountryCode}${digits.replace(/^0+/, '')}`;
  else return null;
  return /^[1-9]\d{7,14}$/.test(international) ? `+${international}` : null;
};

/**
 * O endereço como a página de descadastro e a Auditoria o mostram a quem não precisa vê-lo inteiro:
 * `a***@example.com`, `+55*******8888`. O link pode ser repassado, e quem o abre não deve aprender
 * o endereço de ninguém.
 */
export const maskContactAddress = (channel: ContactChannel, address: string): string => {
  if (channel === 'email') {
    const at = address.indexOf('@');
    if (at <= 0) return '***';
    return `${address[0]}***${address.slice(at)}`;
  }
  if (address.length <= 6) return '***';
  return `${address.slice(0, 3)}${'*'.repeat(address.length - 7)}${address.slice(-4)}`;
};

/**
 * Os provedores de SMS. `twilio` fala a API dele; `webhook` faz um POST JSON a um endereço do
 * escritório — a ponte para qualquer outro provedor, sem que o kernel conheça o nome de nenhum.
 */
export const SMS_PROVIDERS = ['twilio', 'webhook'] as const;

export type SmsProvider = (typeof SMS_PROVIDERS)[number];

/**
 * A configuração do provedor de SMS do escritório. O SEGREDO (o token da Twilio, o do webhook) não
 * está aqui: entra pela callable e nunca volta — `NotificationSmsSettingsView` diz SE ele existe.
 */
export interface NotificationSmsSettings {
  provider: SmsProvider;
  /** O `Account SID` da Twilio. */
  accountSid: string;
  /** O remetente: número em E.164 ou o `Messaging Service SID` (`MG…`) da Twilio. */
  fromNumber: string;
  /** O endereço `https` que recebe `{ to, body }` no provedor `webhook`. */
  webhookUrl: string;
  /** O país dos números gravados sem ele — `55` para "(71) 99999-8888". */
  defaultCountryCode: string;
  /**
   * O endereço da aplicação, base do link de descadastro que todo SMS leva. Carimbado por quem salvou,
   * a partir do navegador — como o do e-mail, e pelo mesmo motivo: o servidor não sabe onde o app mora.
   */
  appUrl: string;
}

export interface NotificationSmsSettingsView extends NotificationSmsSettings {
  configured: boolean;
  hasSecret: boolean;
}

export const EMPTY_NOTIFICATION_SMS_SETTINGS: NotificationSmsSettings = {
  provider: 'twilio',
  accountSid: '',
  fromNumber: '',
  webhookUrl: '',
  defaultCountryCode: '',
  appUrl: '',
};

/**
 * O que está errado numa configuração de SMS, como referência de mensagem. A MESMA conferência roda no
 * formulário e na callable — o servidor não confia no que a tela já conferiu. O endereço do webhook
 * passa pela guarda dos POSTs que o servidor faz: um endereço interno faria da configuração uma forma
 * de pôr a function para falar com a rede de dentro.
 */
export const notificationSmsSettingsIssue = (settings: NotificationSmsSettings): string | null => {
  if (!SMS_PROVIDERS.includes(settings.provider)) return '@core.automation/notifications.sms.issue.provider';
  if (!isCountryCode(settings.defaultCountryCode)) return '@core.automation/notifications.sms.issue.country';
  if (!/^https?:\/\/[^\s]+$/.test(settings.appUrl)) return '@core.automation/notifications.sms.issue.app-url';
  if (settings.provider === 'twilio') {
    if (!/^AC[0-9a-fA-F]{32}$/.test(settings.accountSid)) return '@core.automation/notifications.sms.issue.account';
    const from = settings.fromNumber.trim();
    if (!/^MG[0-9a-fA-F]{32}$/.test(from) && !/^\+[1-9]\d{7,14}$/.test(from)) {
      return '@core.automation/notifications.sms.issue.from';
    }
    return null;
  }
  return isPublicHttpsEndpoint(settings.webhookUrl) ? null : '@core.automation/notifications.sms.issue.webhook';
};

/** O corpo do SMS antes da linha de descadastro — três mensagens de 160 caracteres. */
export const SMS_BODY_MAX_LENGTH = 480;
