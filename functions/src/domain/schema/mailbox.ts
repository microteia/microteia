// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/mailbox.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/mailbox.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NativeFieldSpec } from './entityRegistry';

/**
 * O gatilho "Ao receber e-mail". Quem LÊ a caixa é o kernel, não a automação: o ponto de leitura (o
 * UID do IMAP, o `historyId` do Gmail) é da CAIXA, e duas automações na mesma caixa leriam tudo duas
 * vezes se cada uma guardasse o seu. A automação só declara o que quer receber (`mailFilter`).
 *
 * O nome não colide com evento de coleção: `received` não é ação de registro, e
 * `splitEntityEventName` o devolve como `null`.
 */
export const MAIL_RECEIVED_EVENT = 'mail.received';

/** O kernel a partir do qual o gatilho existe. Num kernel anterior a automação instala e nunca dispara. */
export const MAIL_RECEIVED_SINCE_KERNEL = '2.131.0';

/**
 * As caixas: `tenants/{t}/mailboxes/{id}`. Nenhum cliente lê nem grava — nem o dono: a callable
 * `manageMailbox` é a porta, porque o mesmo documento guarda o ponto de leitura e o prazo da próxima
 * leitura, e um número que decide quando o kernel age não pode vir do navegador.
 */
export const MAILBOXES_COLLECTION = 'mailboxes';

/**
 * As mensagens que alguma automação quis: `tenants/{t}/mail_messages/{hash}`. É a marca de "já
 * entregue" (o id é o hash de caixa + `Message-ID`) e o que permite auditar o que entrou. A mensagem que
 * nenhuma automação assinada quis não é gravada — a caixa é de uma pessoa, e o escritório só recebe o
 * que ela escolheu entregar.
 */
export const MAIL_MESSAGES_COLLECTION = 'mail_messages';

/** A página das caixas — de todo membro com `mailboxes.connect`, e não só de quem monta automação. */
export const MAILBOXES_PAGE_KEY = 'mailboxes';

/** Por quanto tempo a mensagem entregue fica guardada (TTL em `expiresAt`). */
export const MAIL_MESSAGE_RETENTION_DAYS = 30;

/** O tique da função que lê as caixas; abaixo disso o intervalo seria uma promessa que ninguém cumpre. */
export const MAILBOX_POLL_TICK_MINUTES = 5;
export const MAILBOX_MIN_POLL_MINUTES = MAILBOX_POLL_TICK_MINUTES;
export const MAILBOX_DEFAULT_POLL_MINUTES = 15;
export const MAILBOX_MAX_POLL_MINUTES = 1440;

/**
 * Quantas mensagens uma leitura entrega. O que sobra fica para a volta seguinte, que começa na hora: uma
 * caixa com mil e-mails que casam não pode ocupar a função inteira nem estourar o timeout no meio.
 */
export const MAILBOX_MAX_MESSAGES_PER_POLL = 50;

/** O corpo vai no evento, e o evento é um documento: acima disso o texto é cortado, nunca recusado. */
export const MAIL_TEXT_MAX_CHARS = 100_000;
export const MAIL_HTML_MAX_CHARS = 200_000;

/** Quantos termos cada lista do filtro aceita, e de que tamanho. */
export const MAIL_FILTER_MAX_TERMS = 30;
export const MAIL_FILTER_MAX_TERM_LENGTH = 200;

export const MAILBOX_SOURCES = ['imap'] as const;
export type MailboxSource = typeof MAILBOX_SOURCES[number];

/**
 * O que a automação quer receber. Entre as listas vale E; dentro de uma lista, OU. Lista vazia ou
 * ausente não restringe.
 *
 * Remetente: o endereço inteiro (`intimacao@tjba.jus.br`), o domínio (`@tjba.jus.br` ou `tjba.jus.br`,
 * que também casa os subdomínios) ou um curinga de subdomínio (`*.jus.br`). Assunto: trecho, sem
 * diferença de maiúscula nem de acento.
 */
export interface MailFilter {
  from?: string[] | null;
  subject?: string[] | null;
  /** `true`: só com anexo. `false`: só sem. Ausente: tanto faz. */
  hasAttachments?: boolean | null;
}

export interface ImapSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  /** A pasta lida. Vazio é a caixa de entrada. */
  folder: string;
}

export const DEFAULT_IMAP_FOLDER = 'INBOX';

export const EMPTY_IMAP_SETTINGS: ImapSettings = { host: '', port: 993, secure: true, username: '', folder: DEFAULT_IMAP_FOLDER };

/** O que quem configura uma caixa escreve. A senha viaja à parte, e nunca volta. */
export interface MailboxSettings {
  name: string;
  source: MailboxSource;
  imap: ImapSettings;
  pollEveryMinutes: number;
  /** As automações (`mail.received`) que recebem o que chega nesta caixa. */
  subscriptions: string[];
  enabled: boolean;
}

export const EMPTY_MAILBOX_SETTINGS: MailboxSettings = {
  name: '',
  source: 'imap',
  imap: EMPTY_IMAP_SETTINGS,
  pollEveryMinutes: MAILBOX_DEFAULT_POLL_MINUTES,
  subscriptions: [],
  enabled: true,
};

export const MAILBOX_FAILURE_REASONS = ['auth', 'connection', 'folder', 'read'] as const;
export type MailboxFailureReason = typeof MAILBOX_FAILURE_REASONS[number];

export interface MailboxHealth {
  lastPolledAt: string | null;
  lastDeliveredAt: string | null;
  /** Quantas mensagens a última leitura entregou a alguma automação. */
  lastDelivered: number;
  failure: { reason: MailboxFailureReason; message: string; at: string } | null;
}

/** O que a tela recebe de uma caixa: a configuração, de quem é, e como ela vai. Nunca o segredo. */
export interface MailboxView extends MailboxSettings {
  id: string;
  /** Ausente: a caixa é do ESCRITÓRIO. */
  ownerId: string | null;
  ownerName: string | null;
  hasPassword: boolean;
  nextPollAt: string | null;
  health: MailboxHealth;
}

const normalizeText = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const cleanTerms = (terms: readonly string[] | null | undefined): string[] =>
  (terms ?? []).map((term) => (typeof term === 'string' ? term.trim() : '')).filter((term) => term !== '');

/** O filtro declara algo? Ausente e vazio são a mesma resposta: todo e-mail passa. */
export const hasMailFilter = (filter: MailFilter | null | undefined): boolean =>
  !!filter
  && (cleanTerms(filter.from).length > 0 || cleanTerms(filter.subject).length > 0 || typeof filter.hasAttachments === 'boolean');

/**
 * O endereço puro de um remetente: `"Tribunal" <intimacao@tjba.jus.br>` → `intimacao@tjba.jus.br`.
 * O IMAP entrega a lista já separada, mas o filtro também é conferido sobre o que um adaptador de
 * extensão mande, e é ali que o nome de exibição aparece.
 */
export const mailAddressOf = (value: string): string => {
  const bracket = /<([^>]+)>/.exec(value);
  return normalizeText(bracket ? bracket[1] : value);
};

const domainOf = (address: string): string => {
  const at = address.lastIndexOf('@');
  return at >= 0 ? address.slice(at + 1) : address;
};

const isWithinDomain = (domain: string, expected: string): boolean =>
  domain === expected || domain.endsWith(`.${expected}`);

/** O remetente casa com UM termo do filtro? Ver `MailFilter.from`. */
export const matchesSenderTerm = (sender: string, term: string): boolean => {
  const address = mailAddressOf(sender);
  const wanted = normalizeText(term);
  if (!address || !wanted) return false;
  if (wanted.startsWith('*.')) return domainOf(address).endsWith(wanted.slice(1));
  if (wanted.startsWith('@')) return isWithinDomain(domainOf(address), wanted.slice(1));
  if (wanted.includes('@')) return address === wanted;
  return isWithinDomain(domainOf(address), wanted);
};

/** O que o filtro olha numa mensagem — o mínimo, para casar antes de baixar o corpo. */
export interface MailFilterSubject {
  from: string;
  subject: string;
  attachmentCount: number;
}

/**
 * A mensagem passa pelo filtro? A MESMA conta roda na leitura (para decidir o que baixar e a quem
 * entregar) e no motor (a automação cujo filtro mudou entre a leitura e a execução não roda à toa).
 */
export const matchesMailFilter = (filter: MailFilter | null | undefined, message: MailFilterSubject): boolean => {
  if (!filter) return true;
  const senders = cleanTerms(filter.from);
  if (senders.length > 0 && !senders.some((term) => matchesSenderTerm(message.from, term))) return false;
  const subjects = cleanTerms(filter.subject);
  const subject = normalizeText(message.subject ?? '');
  if (subjects.length > 0 && !subjects.some((term) => subject.includes(normalizeText(term)))) return false;
  if (filter.hasAttachments === true && message.attachmentCount === 0) return false;
  if (filter.hasAttachments === false && message.attachmentCount > 0) return false;
  return true;
};

/** O que está errado num filtro, como referência de mensagem. Editor, validação de pacote e callable. */
export const mailFilterIssue = (filter: MailFilter | null | undefined): string | null => {
  if (!filter) return null;
  for (const list of [filter.from, filter.subject]) {
    if (list === undefined || list === null) continue;
    if (!Array.isArray(list)) return '@core.automation/mail.filter.invalid';
    if (list.length > MAIL_FILTER_MAX_TERMS) return '@core.automation/mail.filter.too-many';
    if (list.some((term) => typeof term !== 'string' || term.length > MAIL_FILTER_MAX_TERM_LENGTH)) {
      return '@core.automation/mail.filter.invalid';
    }
  }
  if (cleanTerms(filter.from).some((term) => /\s/.test(term) || term === '*' || term === '*.')) {
    return '@core.automation/mail.filter.sender-invalid';
  }
  return null;
};

/**
 * O pré-filtro que a leitura pede ao SERVIDOR de e-mail, para não listar a caixa inteira: um termo de
 * remetente ou de assunto por consulta, em OU. Só vale quando TODA automação assinada restringe a mesma
 * dimensão — se uma delas aceita qualquer remetente, pedir só os remetentes das outras a deixaria sem
 * nada. É uma peneira grossa (o `SEARCH FROM` do IMAP é trecho do cabeçalho): quem decide é
 * `matchesMailFilter`, depois.
 */
export type MailServerPrefilter =
  | { kind: 'all' }
  | { kind: 'from'; terms: string[] }
  | { kind: 'subject'; terms: string[] };

const serverSenderTerm = (term: string): string => term.trim().replace(/^\*\./, '').replace(/^@/, '');

export const mailServerPrefilter = (filters: ReadonlyArray<MailFilter | null | undefined>): MailServerPrefilter => {
  if (filters.length === 0) return { kind: 'all' };
  const senders = filters.map((filter) => cleanTerms(filter?.from).map(serverSenderTerm).filter((term) => term !== ''));
  if (senders.every((terms) => terms.length > 0)) {
    const terms = [...new Set(senders.flat().map((term) => term.toLowerCase()))];
    if (terms.length <= MAIL_FILTER_MAX_TERMS) return { kind: 'from', terms };
  }
  const subjects = filters.map((filter) => cleanTerms(filter?.subject));
  if (subjects.every((terms) => terms.length > 0)) {
    const terms = [...new Set(subjects.flat())];
    if (terms.length <= MAIL_FILTER_MAX_TERMS) return { kind: 'subject', terms };
  }
  return { kind: 'all' };
};

const isPositiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

/** O que está errado na configuração de uma caixa. A MESMA conferência roda no formulário e na callable. */
export const mailboxSettingsIssue = (settings: MailboxSettings): string | null => {
  if (!settings.name.trim()) return '@core.automation/mailbox.issue.name';
  if (!MAILBOX_SOURCES.includes(settings.source)) return '@core.automation/mailbox.issue.source';
  if (!settings.imap.host.trim() || /\s/.test(settings.imap.host.trim())) return '@core.automation/mailbox.issue.host';
  if (!isPositiveInteger(settings.imap.port) || settings.imap.port > 65535) return '@core.automation/mailbox.issue.port';
  if (!settings.imap.username.trim()) return '@core.automation/mailbox.issue.username';
  if (
    !Number.isInteger(settings.pollEveryMinutes)
    || settings.pollEveryMinutes < MAILBOX_MIN_POLL_MINUTES
    || settings.pollEveryMinutes > MAILBOX_MAX_POLL_MINUTES
  ) {
    return '@core.automation/mailbox.issue.interval';
  }
  return null;
};

/** O payload de `mail.received`: a mensagem, de onde veio, e de quem é a caixa. */
export interface MailEventPayload {
  id: string;
  mailboxId: string;
  /** O dono da caixa; `null` quando ela é do escritório. */
  mailboxOwnerId: string | null;
  messageId: string;
  from: string;
  fromName: string;
  to: string[];
  cc: string[];
  replyTo: string;
  subject: string;
  date: string;
  text: string;
  html: string;
  /** O texto ou o HTML foi cortado no teto. */
  truncated: boolean;
  attachments: Array<{ name: string; contentType: string; size: number }>;
}

/** O "agora" do evento e a retenção são de quem chama: o módulo é puro. */
export const mailMessageExpiresAt = (receivedAt: Date): Date =>
  new Date(receivedAt.getTime() + MAIL_MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

export const MAIL_EVENT_FIELDS: NativeFieldSpec[] = [
  { key: 'from', label: '@core.automation/event-field.mail-from', type: 'string' },
  { key: 'fromName', label: '@core.automation/event-field.mail-from-name', type: 'string' },
  { key: 'to', label: '@core.automation/event-field.mail-to', type: 'stringArray' },
  { key: 'cc', label: '@core.automation/event-field.mail-cc', type: 'stringArray' },
  { key: 'replyTo', label: '@core.automation/event-field.mail-reply-to', type: 'string' },
  { key: 'subject', label: '@core.automation/event-field.mail-subject', type: 'string' },
  { key: 'date', label: '@core.automation/event-field.mail-date', type: 'date' },
  { key: 'text', label: '@core.automation/event-field.mail-text', type: 'string' },
  { key: 'html', label: '@core.automation/event-field.mail-html', type: 'string' },
  { key: 'truncated', label: '@core.automation/event-field.mail-truncated', type: 'boolean' },
  { key: 'messageId', label: '@core.automation/event-field.mail-message-id', type: 'string' },
  { key: 'mailboxId', label: '@core.automation/event-field.mail-mailbox-id', type: 'string' },
  { key: 'mailboxOwnerId', label: '@core.automation/event-field.mail-mailbox-owner-id', type: 'string' },
  // Um campo só, sem subcampos: cada anexo é `{ name, contentType, size }`, e o editor oferece a lista
  // inteira — para o passo de laço ou para `length` numa condição.
  { key: 'attachments', label: '@core.automation/event-field.mail-attachments', type: 'object', list: true },
];
