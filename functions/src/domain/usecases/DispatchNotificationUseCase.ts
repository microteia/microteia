import type { CreateAuditLogUseCase } from './CreateAuditLogUseCase';
import type {
  EmailMessage,
  IEmailTransport,
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
  notificationTemplateFor,
  type NotificationEmailLayout,
  type NotificationTemplates,
} from '../schema/notificationTemplate';

/**
 * Um pedido de aviso — de QUALQUER origem. O passo "Notificar" é uma delas; o portal é outra; uma
 * extensão de backend pode ser a próxima. Todas passam pela mesma porta, e por isso as mesmas
 * garantias valem para todas: só membro recebe, a preferência da pessoa vence, cada canal falha
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
  channels: Record<NotificationChannel, boolean>;
  /**
   * `portal`: recebem os convidados do portal que veem `target` — e só eles; `recipientIds` e
   * `recipientPermissions` não valem. Ausente, os membros.
   */
  audience?: NotificationAudience;
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
  tenantName: (tenantId: string) => Promise<string>;
  now: () => Date;
}

export type DispatchNotificationUseCase = {
  execute: (request: DispatchNotificationRequest) => Promise<DispatchNotificationResult>;
};

const EMAIL_CONCURRENCY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const toPortal = (request: DispatchNotificationRequest): boolean => request.audience === 'portal';

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
    if (seen.guests.length > NOTIFICATION_MAX_RECIPIENTS) {
      issues.push({
        message: '@core.automation/step.notify.recipients.truncated',
        params: { max: String(NOTIFICATION_MAX_RECIPIENTS) },
      });
    }
    return deps.directory.guests(request.tenantId, seen.guests.slice(0, NOTIFICATION_MAX_RECIPIENTS));
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
    recipients: NotificationRecipient[],
    resolverFor: (locale: string) => Promise<NotificationTextResolver>,
    issues: DispatchIssue[],
    look: Appearance,
    variablesFor: (recipient: NotificationRecipient) => Promise<Record<string, string>>,
  ): Promise<{ delivered: number; failed: number }> => {
    const credential = await deps.emailConfig.get(request.tenantId);
    if (!credential) {
      issues.push({ message: '@core.automation/step.notify.email.not-configured' });
      return { delivered: 0, failed: recipients.length };
    }
    const tenant = await deps.tenantName(request.tenantId);
    const linkUrl = notificationLinkUrl(credential.settings.appUrl, deepLinkOf(request));
    const session = deps.emailTransport.open(credential);
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
            : resolve('@core.automation/notifications.email.footer', { tenant }),
          tenantName: tenant,
          logoURL: look.logoURL,
          layout: look.layout,
        });
        try {
          await session.send(message);
          delivered += 1;
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
    return { delivered, failed };
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
          return { recipients: 0, delivered, failed, issues };
        }
      }

      if (request.channels.audit) {
        if (await toAudit(request)) delivered.audit = 1;
        else failed.audit = 1;
      }

      const personal = request.channels.inApp || request.channels.email || request.channels.push;
      if (!personal) return { recipients: 0, delivered, failed, issues };

      const recipients = await recipientsOf(request, issues);
      if (recipients.length === 0) {
        issues.push({ message: '@core.automation/step.notify.recipients.none' });
        return { recipients: 0, delivered, failed, issues };
      }

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
          ? toEmail(request, email, resolverFor, issues, appearance, variablesFor).catch(() => ({ delivered: 0, failed: email.length }))
          : Promise.resolve({ delivered: 0, failed: 0 }),
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

      return { recipients: recipients.length, delivered, failed, issues };
    },
  };
};
