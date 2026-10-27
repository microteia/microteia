import type { CreateAuditLogUseCase } from './CreateAuditLogUseCase';
import type {
  ContactAddress,
  ContactState,
  EmailMessage,
  IEmailTransport,
  INotificationContactLog,
  INotificationSmsConfigRepository,
  ISmsTransport,
  NotificationEmailCredential,
  NotificationSmsCredential,
  INotificationDirectory,
  INotificationAppearance,
  INotificationDispatchLog,
  INotificationEmailConfigRepository,
  INotificationInboxRepository,
  INotificationTextCatalog,
  IWebPushSender,
  NotificationRecipient,
  NotificationTextResolver,
} from '../repositories/INotificationDelivery';
import type { InboxNotificationDocument, NotificationAudience, NotificationChannel, WebPushPayload } from '../schema/notifications';
import type { ResolvePortalGuestsUseCase } from './ResolvePortalGuestsUseCase';
import { portalRecordPath } from '../schema/portal';
import type { ContactChannel } from '../schema/notificationContacts';
import {
  contactValues,
  normalizeContactEmail,
  normalizePhoneNumber,
  notificationOptOutPath,
  SMS_BODY_MAX_LENGTH,
} from '../schema/notificationContacts';
import {
  isNotificationMuted,
  notificationDedupDocId,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_INBOX_RETENTION_DAYS,
  NOTIFICATION_MAX_RECIPIENTS,
  NOTIFICATION_MESSAGE_MAX_LENGTH,
  NOTIFICATION_TITLE_MAX_LENGTH,
} from '../schema/notifications';
import { notificationLinkUrl, renderNotificationEmail } from '../services/notificationEmail';
import { appDeepLinkPath, recordLinkTabKey, type RecordLinkTarget } from '../schema/recordLink';
import {
  DEFAULT_NOTIFICATION_EMAIL_LAYOUT,
  escapeMarkdown,
  fillNotificationTemplate,
  notificationMarkdownToText,
  notificationTemplateFor,
  type NotificationEmailLayout,
  type NotificationTemplates,
} from '../schema/notificationTemplate';

/**
 * A quem o aviso se dirige: aos membros, aos convidados do portal que veem o registro, ou aos
 * ENDEREÇOS lidos de campos de contato (`contacts`) — quem não tem conta nenhuma no escritório.
 */
export type DispatchAudience = NotificationAudience | 'contacts';

/** Os destinos pedidos. `sms` é opcional porque só os endereços o têm, e nenhuma outra origem o pede. */
export type NotificationChannelSwitches = Record<Exclude<NotificationChannel, 'sms'>, boolean> & { sms?: boolean };

/**
 * Um pedido de aviso — de QUALQUER origem. O passo "Notificar" é uma delas; o portal é outra; uma
 * extensão de backend pode ser a próxima. Todas passam pela mesma porta, e por isso as mesmas
 * garantias valem para todas: recebe só quem o público admite (membro conferido, convidado que vê o
 * registro, endereço que não se descadastrou), a preferência da pessoa vence, cada canal falha
 * sozinho, e o mesmo `dedupKey` não avisa duas vezes.
 */
export interface DispatchNotificationRequest {
  tenantId: string;
  /** Quem avisa: `workflow`, ou o módulo (`core.tenant/portal`). Vai para o aviso e para a Auditoria. */
  source: string;
  /** Só quando a origem é uma automação. */
  workflowId?: string;
  executionId?: string;
  title: string;
  message: string;
  params: Record<string, string>;
  /** Uma aba qualquer, para o que não é registro. `target` vence quando os dois vêm. */
  link: string;
  /** O registro de que o aviso fala — o clique o abre, no app, no push e no e-mail. */
  target?: RecordLinkTarget | null;
  /** O tipo (`<plugin>/<chave>`): é por ele que a pessoa silencia um canal. */
  category?: string;
  /** Mesma chave, um aviso só — a reexecução não repete o e-mail. */
  dedupKey?: string;
  channels: NotificationChannelSwitches;
  /**
   * `portal`: recebem os convidados do portal que veem `target` — e só eles; `recipientPermissions`
   * não vale, e `recipientIds`, quando vem, ESTREITA esse conjunto (o convite novo avisa só quem foi
   * convidado), nunca o alarga: um uid que não vê o registro continua sem receber. Ausente, os membros.
   *
   * `contacts`: recebem os endereços de `contacts` — e só eles, por e-mail e SMS. Quem pede já conferiu
   * que cada um veio de um campo que a tela declarou de contato; aqui o endereço é normalizado, quem
   * se descadastrou fica de fora, e cada envio deixa uma entrada na Auditoria.
   */
  audience?: DispatchAudience;
  /** Os valores lidos dos campos de contato, ainda como foram digitados. Só com `audience: 'contacts'`. */
  contacts?: { email: readonly string[]; sms: readonly string[] };
  recipientIds: readonly string[];
  /** Recebem os membros que têm TODAS estas permissões — "pode alterar" E "é responsável". */
  recipientPermissions: readonly string[];
}

export type ChannelCounts = Record<NotificationChannel, number>;

/** Um aviso para o log da execução: referência de mensagem e o que ela interpola. */
export interface DispatchIssue {
  message: string;
  params?: Record<string, string>;
}

export interface DispatchNotificationResult {
  recipients: number;
  delivered: ChannelCounts;
  failed: ChannelCounts;
  /** Endereços que pediram para não receber mais — recusa da pessoa, não falha. */
  optedOut: number;
  issues: DispatchIssue[];
}

export interface DispatchNotificationDeps {
  createAuditLog: CreateAuditLogUseCase;
  directory: INotificationDirectory;
  inbox: INotificationInboxRepository;
  emailConfig: INotificationEmailConfigRepository;
  emailTransport: IEmailTransport;
  push: IWebPushSender;
  catalog: INotificationTextCatalog;
  dispatches: INotificationDispatchLog;
  /** O layout do e-mail, os modelos por tipo e canal, e o logo — o que o ESCRITÓRIO escolheu. */
  appearance: INotificationAppearance;
  /** Quem do portal vê um registro agora — a porta pela qual um convidado vira destinatário. */
  portalGuests: ResolvePortalGuestsUseCase;
  /** Os endereços já escritos e os descadastrados. */
  contacts: INotificationContactLog;
  smsConfig: INotificationSmsConfigRepository;
  smsTransport: ISmsTransport;
  tenantName: (tenantId: string) => Promise<string>;
  now: () => Date;
}

export type DispatchNotificationUseCase = {
  execute: (request: DispatchNotificationRequest) => Promise<DispatchNotificationResult>;
};

const EMAIL_CONCURRENCY = 5;
const SMS_CONCURRENCY = 5;
const AUDIT_CONCURRENCY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const toPortal = (request: DispatchNotificationRequest): boolean => request.audience === 'portal';
const toContacts = (request: DispatchNotificationRequest): boolean => request.audience === 'contacts';

type ContactOutcome = 'sent' | 'failed' | 'opted-out';

const CONTACT_AUDIT_TITLES: Record<ContactChannel, Record<ContactOutcome, string>> = {
  email: {
    sent: '@core.automation/notifications.contacts.audit.email.sent',
    failed: '@core.automation/notifications.contacts.audit.email.failed',
    'opted-out': '@core.automation/notifications.contacts.audit.email.opted-out',
  },
  sms: {
    sent: '@core.automation/notifications.contacts.audit.sms.sent',
    failed: '@core.automation/notifications.contacts.audit.sms.failed',
    'opted-out': '@core.automation/notifications.contacts.audit.sms.opted-out',
  },
};

interface SendOutcome {
  delivered: number;
  failed: number;
  /** Os `userId` que receberam — a Auditoria por envio precisa saber QUEM, não só quantos. */
  sentTo: Set<string>;
}

const noSends = (failed = 0): SendOutcome => ({ delivered: 0, failed, sentTo: new Set() });

/**
 * O caminho que abre o aviso FORA do app — no push e no e-mail —, com o escritório junto. O do
 * convidado é o registro NO PORTAL: o espaço de trabalho do escritório ele não abre.
 */
const deepLinkOf = (request: DispatchNotificationRequest): string =>
  toPortal(request) && request.target
    ? portalRecordPath(request.tenantId, request.target.collection, request.target.recordId)
    : appDeepLinkPath(request.target ? recordLinkTabKey(request.target) : request.link, request.tenantId);

interface Appearance {
  layout: NotificationEmailLayout;
  templates: NotificationTemplates;
  logoURL: string | null;
}

const zeroCounts = (): ChannelCounts =>
  Object.fromEntries(NOTIFICATION_CHANNELS.map((channel) => [channel, 0])) as ChannelCounts;

const clip = (value: string, max: number): string => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

const runLimited = async <T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> => {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};

/**
 * Entrega uma notificação nos destinos pedidos.
 *
 * Cada canal falha SOZINHO: um servidor de e-mail fora do ar não impede o sino nem o push, e a
 * contagem diz o que chegou. É por isso que o resultado não é um booleano — o passo publica
 * `delivered`/`failed` por canal, e o fluxo decide o que fazer com a falha (outro canal, um alerta).
 *
 * A preferência da pessoa vence o fluxo: quem desligou o e-mail em Configurações não o recebe, e
 * isso não conta como falha. Recusar não é falhar.
 */
export const makeDispatchNotificationUseCase = (deps: DispatchNotificationDeps): DispatchNotificationUseCase => {
  const resolverCache = (tenantId: string) => {
    const resolvers = new Map<string, Promise<NotificationTextResolver>>();
    return (locale: string): Promise<NotificationTextResolver> => {
      const cached = resolvers.get(locale);
      if (cached) return cached;
      const created = deps.catalog.resolverFor(tenantId, locale);
      resolvers.set(locale, created);
      return created;
    };
  };

  const guestsOf = async (request: DispatchNotificationRequest, issues: DispatchIssue[]): Promise<NotificationRecipient[]> => {
    if (!request.target) {
      issues.push({ message: '@core.automation/step.notify.portal.no-record' });
      return [];
    }
    const seen = await deps.portalGuests.execute(request.tenantId, request.target);
    if (!seen.inPortal) {
      issues.push({ message: '@core.automation/step.notify.portal.not-in-portal' });
      return [];
    }
    const only = new Set(request.recipientIds);
    const guests = only.size > 0 ? seen.guests.filter((guest) => only.has(guest.userId)) : seen.guests;
    if (guests.length > NOTIFICATION_MAX_RECIPIENTS) {
      issues.push({
        message: '@core.automation/step.notify.recipients.truncated',
        params: { max: String(NOTIFICATION_MAX_RECIPIENTS) },
      });
    }
    return deps.directory.guests(request.tenantId, guests.slice(0, NOTIFICATION_MAX_RECIPIENTS));
  };

  const recipientsOf = async (request: DispatchNotificationRequest, issues: DispatchIssue[]): Promise<NotificationRecipient[]> => {
    if (toPortal(request)) return guestsOf(request, issues);
    const ids = new Set(request.recipientIds);
    const permissions = [...new Set(request.recipientPermissions.filter((permission) => permission !== ''))];
    if (permissions.length > 0) {
      // A interseção: quem tem a primeira E a segunda. O teto é por permissão, e a de cima pode ser
      // larga ("pode alterar empresas") — por isso cada consulta vai até um acima do teto.
      const holdersOf = await Promise.all(permissions.map(async (permission) => new Set<string>(
        await deps.directory.memberIdsGranting(request.tenantId, permission, NOTIFICATION_MAX_RECIPIENTS * permissions.length + 1),
      )));
      const [first, ...rest] = holdersOf;
      for (const id of first) {
        if (rest.every((holders) => holders.has(id))) ids.add(id);
      }
    }
    const candidates = [...ids];
    if (candidates.length > NOTIFICATION_MAX_RECIPIENTS) {
      issues.push({
        message: '@core.automation/step.notify.recipients.truncated',
        params: { max: String(NOTIFICATION_MAX_RECIPIENTS) },
      });
    }
    const limited = candidates.slice(0, NOTIFICATION_MAX_RECIPIENTS);
    const recipients = limited.length > 0 ? await deps.directory.recipients(request.tenantId, limited) : [];
    if (recipients.length < limited.length) {
      issues.push({
        message: '@core.automation/step.notify.recipients.not-members',
        params: { count: String(limited.length - recipients.length) },
      });
    }
    return recipients;
  };

  const toAudit = async (request: DispatchNotificationRequest): Promise<boolean> => {
    try {
      await deps.createAuditLog.execute({
        tenantId: request.tenantId,
        title: request.title,
        ...(Object.keys(request.params).length > 0 ? { titleParams: request.params, textParams: request.params } : {}),
        userId: 'system',
        userName: '@core.automation/run.actor',
        photoURL: '',
        action: 'SYSTEM',
        severity: 'CRITICAL',
        type: 'AUDIT',
        entity: request.workflowId ? 'workflow' : request.source,
        entityId: request.workflowId || request.target?.recordId || '',
        ...(request.link ? { entityLink: request.link } : {}),
        ...(request.target ? { linkCollection: request.target.collection, linkRecordId: request.target.recordId } : {}),
        text: request.message,
      });
      return true;
    } catch {
      return false;
    }
  };

  /**
   * O que saiu do escritório fica registrado nele: para quantos convidados, sobre qual registro, e o
   * que dizia. Não depende de `toAudit` — aquele é o aviso AO escritório; este é o rastro do que foi
   * dito para fora.
   */
  const auditPortalDelivery = async (request: DispatchNotificationRequest, count: number): Promise<void> => {
    try {
      await deps.createAuditLog.execute({
        tenantId: request.tenantId,
        title: '@core.automation/notifications.portal.audit',
        titleParams: { count: String(count) },
        userId: 'system',
        userName: '@core.automation/run.actor',
        photoURL: '',
        action: 'SYSTEM',
        type: 'AUDIT',
        entity: request.workflowId ? 'workflow' : request.source,
        entityId: request.workflowId || request.target?.recordId || '',
        ...(request.target ? { linkCollection: request.target.collection, linkRecordId: request.target.recordId } : {}),
        text: request.title,
        ...(Object.keys(request.params).length > 0 ? { textParams: request.params } : {}),
      });
    } catch {
      // O rastro é do escritório; o convidado já foi avisado, e isso não se desfaz.
    }
  };

  const toInbox = async (
    request: DispatchNotificationRequest,
    recipients: NotificationRecipient[],
    look: Appearance,
    variablesFor: (recipient: NotificationRecipient) => Promise<Record<string, string>>,
  ): Promise<boolean> => {
    const createdAt = deps.now();
    const expiresAt = new Date(createdAt.getTime() + NOTIFICATION_INBOX_RETENTION_DAYS * DAY_MS);
    const template = notificationTemplateFor(look.templates, request.category ?? '', 'inApp');
    const portal = toPortal(request);
    // Sem modelo, o sino guarda a REFERÊNCIA e resolve na tela, no idioma de quem lê. Com modelo, o
    // texto é do escritório e já sai preenchido para cada pessoa — as variáveis no idioma dela. O do
    // convidado sai sempre resolvido: o portal não tem o catálogo de toda extensão.
    const resolved = !!template || portal;
    const documents: InboxNotificationDocument[] = await Promise.all(recipients.map(async (recipient) => {
      const variables = resolved ? await variablesFor(recipient) : {};
      const title = template?.title ? fillNotificationTemplate(template.title, variables) : resolved ? variables.title : request.title;
      const message = template?.message ? fillNotificationTemplate(template.message, variables) : resolved ? variables.message : request.message;
      return {
        audience: portal ? 'portal' : 'members',
        recipientId: recipient.userId,
        title: clip(title, NOTIFICATION_TITLE_MAX_LENGTH),
        message: clip(message, NOTIFICATION_MESSAGE_MAX_LENGTH),
        params: resolved ? {} : request.params,
      link: portal ? '' : request.link,
      target: request.target ?? null,
      category: request.category ?? '',
      source: request.source,
      read: false,
      createdAt,
      readAt: null,
      expiresAt,
        workflowId: request.workflowId ?? '',
        executionId: request.executionId ?? '',
      };
    }));
    try {
      await deps.inbox.deliver(request.tenantId, documents);
      return true;
    } catch {
      return false;
    }
  };

  const toEmail = async (
    request: DispatchNotificationRequest,
    credential: NotificationEmailCredential | null,
    recipients: NotificationRecipient[],
    resolverFor: (locale: string) => Promise<NotificationTextResolver>,
    issues: DispatchIssue[],
    look: Appearance,
    variablesFor: (recipient: NotificationRecipient) => Promise<Record<string, string>>,
  ): Promise<SendOutcome> => {
    if (!credential) {
      issues.push({ message: '@core.automation/step.notify.email.not-configured' });
      return noSends(recipients.length);
    }
    const tenant = await deps.tenantName(request.tenantId);
    // Quem recebe num endereço não tem conta onde abrir o registro: o e-mail não leva botão, e o
    // rodapé padrão não fala de Configurações que ele não tem.
    const external = toContacts(request);
    const linkUrl = external ? '' : notificationLinkUrl(credential.settings.appUrl, deepLinkOf(request));
    const footerKey = external ? '@core.automation/notifications.contacts.footer' : '@core.automation/notifications.email.footer';
    const session = deps.emailTransport.open(credential);
    const sentTo = new Set<string>();
    let delivered = 0;
    let failed = 0;
    let firstError = '';
    try {
      await runLimited(recipients, EMAIL_CONCURRENCY, async (recipient) => {
        const resolve = await resolverFor(recipient.locale);
        const variables = await variablesFor(recipient);
        const template = notificationTemplateFor(look.templates, request.category ?? '', 'email');
        // O corpo é Markdown; o que vem do registro entra ESCAPADO — um valor digitado por qualquer
        // membro não vira link num e-mail que sai com a cara do escritório.
        const message: EmailMessage = renderNotificationEmail({
          to: recipient.email,
          title: clip(template?.subject ? fillNotificationTemplate(template.subject, variables) : variables.title, NOTIFICATION_TITLE_MAX_LENGTH),
          message: clip(
            template?.body ? fillNotificationTemplate(template.body, variables, escapeMarkdown) : escapeMarkdown(variables.message),
            NOTIFICATION_MESSAGE_MAX_LENGTH,
          ),
          linkUrl,
          linkLabel: resolve('@core.automation/notifications.email.open', {}),
          footer: look.layout.footer
            ? fillNotificationTemplate(look.layout.footer, variables)
            : resolve(footerKey, { tenant }),
          tenantName: tenant,
          logoURL: look.logoURL,
          layout: look.layout,
          unsubscribe: recipient.optOutUrl
            ? { url: recipient.optOutUrl, label: resolve('@core.automation/notifications.contacts.opt-out', {}) }
            : null,
        });
        try {
          await session.send(message);
          delivered += 1;
          sentTo.add(recipient.userId);
        } catch (error) {
          failed += 1;
          firstError ||= error instanceof Error ? error.message : String(error);
        }
      });
    } finally {
      session.close();
    }
    if (failed > 0) {
      issues.push({ message: '@core.automation/step.notify.email.failed', params: { count: String(failed), detail: firstError } });
    }
    return { delivered, failed, sentTo };
  };

  const toPush = async (
    request: DispatchNotificationRequest,
    recipients: NotificationRecipient[],
    look: Appearance,
    variablesFor: (recipient: NotificationRecipient) => Promise<Record<string, string>>,
  ): Promise<{ delivered: number; failed: number }> => {
    const payloads = new Map<string, WebPushPayload>();
    const template = notificationTemplateFor(look.templates, request.category ?? '', 'push');
    for (const recipient of recipients) {
      const variables = await variablesFor(recipient);
      payloads.set(recipient.userId, {
        title: clip(template?.title ? fillNotificationTemplate(template.title, variables) : variables.title, NOTIFICATION_TITLE_MAX_LENGTH),
        body: clip(template?.body ? fillNotificationTemplate(template.body, variables) : variables.message, NOTIFICATION_TITLE_MAX_LENGTH * 2),
        link: deepLinkOf(request),
        tenantId: request.tenantId,
        tag: request.dedupKey || `${request.source}:${request.executionId ?? ''}:${request.workflowId ?? ''}`,
      });
    }
    const result = await deps.push.send(payloads);
    return { delivered: result.delivered.size, failed: result.failed.size };
  };

  /** O preparo comum a todo público: a aparência do escritório e as variáveis de cada idioma. */
  const presentationFor = async (request: DispatchNotificationRequest) => {
    const resolverFor = resolverCache(request.tenantId);
    // A aparência é enfeite: se não puder ser lida, o aviso sai com o texto e o layout padrão.
    const [appearance, tenant] = await Promise.all([
      deps.appearance.get(request.tenantId)
        .catch((): Appearance => ({ layout: DEFAULT_NOTIFICATION_EMAIL_LAYOUT, templates: {}, logoURL: null })),
      deps.tenantName(request.tenantId),
    ]);
    // As variáveis de um modelo, no idioma de cada destinatário: título e mensagem já resolvidos,
    // os parâmetros do aviso, e o nome do escritório.
    const variablesFor = async (recipient: NotificationRecipient): Promise<Record<string, string>> => {
      const resolve = await resolverFor(recipient.locale);
      return {
        ...request.params,
        title: resolve(request.title, request.params),
        message: resolve(request.message, request.params),
        tenant,
      };
    };
    return { resolverFor, appearance, variablesFor };
  };

  /**
   * Os endereços como serão escritos: normalizados, sem repetição, no máximo o teto. O telefone precisa
   * do país, que é da configuração de SMS — sem ela não há como lê-lo, e cada um conta como falha.
   */
  const contactAddressesOf = (
    request: DispatchNotificationRequest,
    sms: NotificationSmsCredential | null,
    issues: DispatchIssue[],
  ): { addresses: ContactAddress[]; unsendableSms: number } => {
    const raw = request.contacts ?? { email: [], sms: [] };
    const seen = new Set<string>();
    const addresses: ContactAddress[] = [];
    let invalid = 0;
    const add = (channel: ContactChannel, address: string | null) => {
      if (!address) {
        invalid += 1;
        return;
      }
      if (seen.has(`${channel}:${address}`)) return;
      seen.add(`${channel}:${address}`);
      addresses.push({ channel, address });
    };
    if (request.channels.email) for (const value of contactValues(raw.email)) add('email', normalizeContactEmail(value));
    const phones = contactValues(raw.sms);
    let unsendableSms = 0;
    if (request.channels.sms && phones.length > 0) {
      if (sms) {
        for (const value of phones) add('sms', normalizePhoneNumber(value, sms.settings.defaultCountryCode));
      } else {
        unsendableSms = new Set(phones).size;
        issues.push({ message: '@core.automation/step.notify.sms.not-configured' });
      }
    }
    if (invalid > 0) {
      issues.push({ message: '@core.automation/step.notify.contacts.invalid', params: { count: String(invalid) } });
    }
    if (addresses.length > NOTIFICATION_MAX_RECIPIENTS) {
      issues.push({
        message: '@core.automation/step.notify.recipients.truncated',
        params: { max: String(NOTIFICATION_MAX_RECIPIENTS) },
      });
    }
    return { addresses: addresses.slice(0, NOTIFICATION_MAX_RECIPIENTS), unsendableSms };
  };

  /** Quem recebe num endereço, na forma que os canais entendem: o bilhete é a identidade dele. */
  const contactRecipient = (tenantId: string, state: ContactState, locale: string, appUrl: string): NotificationRecipient => ({
    userId: state.ticket,
    email: state.channel === 'email' ? state.address : '',
    locale,
    channels: { inApp: false, email: state.channel === 'email', push: false },
    mutes: {},
    optOutUrl: notificationLinkUrl(appUrl, notificationOptOutPath(tenantId, state.ticket, locale)),
  });

  /**
   * O SMS: o escritório, o título e a mensagem em texto puro, e a linha de descadastro — que nunca é
   * cortada: é ela que a pessoa precisa para dizer não.
   */
  const toSms = async (
    credential: NotificationSmsCredential,
    targets: readonly { state: ContactState; recipient: NotificationRecipient }[],
    resolverFor: (locale: string) => Promise<NotificationTextResolver>,
    issues: DispatchIssue[],
    variablesFor: (recipient: NotificationRecipient) => Promise<Record<string, string>>,
  ): Promise<SendOutcome> => {
    const session = deps.smsTransport.open(credential);
    const sentTo = new Set<string>();
    let failed = 0;
    let firstError = '';
    await runLimited(targets, SMS_CONCURRENCY, async ({ state, recipient }) => {
      const resolve = await resolverFor(recipient.locale);
      const variables = await variablesFor(recipient);
      const text = clip(`${variables.tenant}: ${variables.title}\n${notificationMarkdownToText(variables.message)}`, SMS_BODY_MAX_LENGTH);
      const optOut = resolve('@core.automation/notifications.sms.opt-out', { url: recipient.optOutUrl ?? '' });
      try {
        await session.send(state.address, `${text}\n${optOut}`);
        sentTo.add(state.ticket);
      } catch (error) {
        failed += 1;
        firstError ||= error instanceof Error ? error.message : String(error);
      }
    });
    if (failed > 0) {
      issues.push({ message: '@core.automation/step.notify.sms.failed', params: { count: String(failed), detail: firstError } });
    }
    return { delivered: sentTo.size, failed, sentTo };
  };

  /**
   * Uma entrada na Auditoria POR ENVIO a um endereço — e também por endereço que NÃO recebeu porque
   * se descadastrou. Quem tem de provar que avisou (ou por que não avisou) precisa do endereço e do
   * instante de cada um, e não de uma contagem. Não depende de `toAudit`, como o rastro do portal.
   */
  const auditContactSends = async (
    request: DispatchNotificationRequest,
    outcomes: readonly { state: ContactState; outcome: ContactOutcome }[],
  ): Promise<void> => {
    await runLimited(outcomes, AUDIT_CONCURRENCY, async ({ state, outcome }) => {
      try {
        await deps.createAuditLog.execute({
          tenantId: request.tenantId,
          title: CONTACT_AUDIT_TITLES[state.channel][outcome],
          titleParams: { address: state.address },
          userId: 'system',
          userName: '@core.automation/run.actor',
          photoURL: '',
          action: 'SYSTEM',
          type: 'AUDIT',
          ...(outcome === 'failed' ? { severity: 'HIGH' as const } : {}),
          entity: request.workflowId ? 'workflow' : request.source,
          entityId: request.workflowId || request.target?.recordId || '',
          ...(request.target ? { linkCollection: request.target.collection, linkRecordId: request.target.recordId } : {}),
          text: request.title,
          ...(Object.keys(request.params).length > 0 ? { textParams: request.params } : {}),
        });
      } catch {
        // O envio já aconteceu (ou não), e isso não se desfaz por a Auditoria não ter gravado.
      }
    });
  };

  const dispatchToContacts = async (
    request: DispatchNotificationRequest,
    delivered: ChannelCounts,
    failed: ChannelCounts,
    issues: DispatchIssue[],
  ): Promise<DispatchNotificationResult> => {
    if (request.channels.inApp || request.channels.push) {
      issues.push({ message: '@core.automation/step.notify.contacts.channel-unsupported' });
    }
    const [emailCredential, smsCredential] = await Promise.all([
      request.channels.email ? deps.emailConfig.get(request.tenantId) : Promise.resolve(null),
      request.channels.sms ? deps.smsConfig.get(request.tenantId) : Promise.resolve(null),
    ]);
    const { addresses, unsendableSms } = contactAddressesOf(request, smsCredential, issues);
    failed.sms += unsendableSms;
    if (addresses.length === 0) {
      if (unsendableSms === 0) issues.push({ message: '@core.automation/step.notify.recipients.none' });
      return { recipients: 0, delivered, failed, optedOut: 0, issues };
    }

    const states = await deps.contacts.status(request.tenantId, addresses);
    const optedOut = states.filter((state) => state.optedOut);
    const reachable = states.filter((state) => !state.optedOut);
    if (optedOut.length > 0) {
      issues.push({ message: '@core.automation/step.notify.contacts.opted-out', params: { count: String(optedOut.length) } });
    }

    // O descadastro tem de funcionar ANTES de a mensagem chegar: sem a marca gravada, o link levaria a
    // "não encontrado". Sem ela, nada sai — mandar sem como dizer não é o que este recurso não faz.
    let recorded = true;
    if (reachable.length > 0) {
      try {
        await deps.contacts.touch(request.tenantId, reachable, deps.now());
      } catch {
        recorded = false;
        issues.push({ message: '@core.automation/step.notify.contacts.record-failed' });
      }
    }

    const [presentation, locale] = await Promise.all([
      presentationFor(request),
      deps.directory.officeLocale(request.tenantId),
    ]);
    const emailStates = reachable.filter((state) => state.channel === 'email');
    const smsStates = reachable.filter((state) => state.channel === 'sms');

    const sendEmail = async (): Promise<SendOutcome> => {
      if (emailStates.length === 0) return noSends();
      if (!recorded) return noSends(emailStates.length);
      const appUrl = emailCredential?.settings.appUrl ?? '';
      if (emailCredential && !appUrl) {
        issues.push({ message: '@core.automation/step.notify.contacts.no-app-url' });
        return noSends(emailStates.length);
      }
      const recipients = emailStates.map((state) => contactRecipient(request.tenantId, state, locale, appUrl));
      return toEmail(request, emailCredential, recipients, presentation.resolverFor, issues, presentation.appearance, presentation.variablesFor)
        .catch(() => noSends(recipients.length));
    };
    const sendSms = async (): Promise<SendOutcome> => {
      if (smsStates.length === 0 || !smsCredential) return noSends();
      if (!recorded) return noSends(smsStates.length);
      const targets = smsStates.map((state) => ({
        state,
        recipient: contactRecipient(request.tenantId, state, locale, smsCredential.settings.appUrl),
      }));
      return toSms(smsCredential, targets, presentation.resolverFor, issues, presentation.variablesFor)
        .catch(() => noSends(targets.length));
    };

    const [emailResult, smsResult] = await Promise.all([sendEmail(), sendSms()]);
    delivered.email = emailResult.delivered;
    failed.email = emailResult.failed;
    delivered.sms = smsResult.delivered;
    failed.sms += smsResult.failed;

    const outcomeOf = (sent: Set<string>) => (state: ContactState) => ({
      state,
      outcome: (sent.has(state.ticket) ? 'sent' : 'failed') as ContactOutcome,
    });
    await auditContactSends(request, [
      ...optedOut.map((state) => ({ state, outcome: 'opted-out' as const })),
      ...emailStates.map(outcomeOf(emailResult.sentTo)),
      ...smsStates.map(outcomeOf(smsResult.sentTo)),
    ]);

    return { recipients: reachable.length, delivered, failed, optedOut: optedOut.length, issues };
  };

  return {
    execute: async (request) => {
      const delivered = zeroCounts();
      const failed = zeroCounts();
      const issues: DispatchIssue[] = [];

      if (request.dedupKey) {
        const expiresAt = new Date(deps.now().getTime() + NOTIFICATION_INBOX_RETENTION_DAYS * DAY_MS);
        const first = await deps.dispatches.claim(request.tenantId, notificationDedupDocId(request.dedupKey), expiresAt);
        if (!first) {
          issues.push({ message: '@core.automation/step.notify.duplicate' });
          return { recipients: 0, delivered, failed, optedOut: 0, issues };
        }
      }

      if (request.channels.audit) {
        if (await toAudit(request)) delivered.audit = 1;
        else failed.audit = 1;
      }

      if (toContacts(request)) return dispatchToContacts(request, delivered, failed, issues);
      if (request.channels.sms) issues.push({ message: '@core.automation/step.notify.sms.contacts-only' });

      const personal = request.channels.inApp || request.channels.email || request.channels.push;
      if (!personal) return { recipients: 0, delivered, failed, optedOut: 0, issues };

      const recipients = await recipientsOf(request, issues);
      if (recipients.length === 0) {
        issues.push({ message: '@core.automation/step.notify.recipients.none' });
        return { recipients: 0, delivered, failed, optedOut: 0, issues };
      }

      const { resolverFor, appearance, variablesFor } = await presentationFor(request);
      const category = request.category ?? '';
      const wants = (channel: 'inApp' | 'email' | 'push') =>
        request.channels[channel]
          ? recipients.filter((recipient) => recipient.channels[channel] && !isNotificationMuted(recipient.mutes, category, channel))
          : [];

      const inApp = wants('inApp');
      const email = wants('email').filter((recipient) => recipient.email);
      const push = wants('push');
      if (toPortal(request) && request.channels.push) {
        issues.push({ message: '@core.automation/step.notify.portal.push-unsupported' });
      }

      const [inboxDelivered, emailResult, pushResult] = await Promise.all([
        inApp.length > 0 ? toInbox(request, inApp, appearance, variablesFor) : Promise.resolve(true),
        email.length > 0
          ? deps.emailConfig.get(request.tenantId)
            .then((credential) => toEmail(request, credential, email, resolverFor, issues, appearance, variablesFor))
            .catch(() => noSends(email.length))
          : Promise.resolve(noSends()),
        push.length > 0
          ? toPush(request, push, appearance, variablesFor).catch(() => ({ delivered: 0, failed: push.length }))
          : Promise.resolve({ delivered: 0, failed: 0 }),
      ]);

      if (inboxDelivered) delivered.inApp = inApp.length;
      else failed.inApp = inApp.length;
      delivered.email = emailResult.delivered;
      failed.email = emailResult.failed;
      delivered.push = pushResult.delivered;
      failed.push = pushResult.failed;

      const reachedGuests = Math.max(delivered.inApp, delivered.email);
      if (toPortal(request) && reachedGuests > 0) await auditPortalDelivery(request, reachedGuests);

      return { recipients: recipients.length, delivered, failed, optedOut: 0, issues };
    },
  };
};
