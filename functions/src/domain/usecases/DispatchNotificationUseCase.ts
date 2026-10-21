import type { CreateAuditLogUseCase } from './CreateAuditLogUseCase';
import type {
  EmailMessage,
  IEmailTransport,
  INotificationDirectory,
  INotificationDispatchLog,
  INotificationEmailConfigRepository,
  INotificationInboxRepository,
  INotificationTextCatalog,
  IWebPushSender,
  NotificationRecipient,
  NotificationTextResolver,
} from '../repositories/INotificationDelivery';
import type { InboxNotificationDocument, NotificationChannel, WebPushPayload } from '../schema/notifications';
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
  tenantName: (tenantId: string) => Promise<string>;
  now: () => Date;
}

export type DispatchNotificationUseCase = {
  execute: (request: DispatchNotificationRequest) => Promise<DispatchNotificationResult>;
};

const EMAIL_CONCURRENCY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

/** O caminho que abre o aviso FORA do app — no push e no e-mail —, com o escritório junto. */
const deepLinkOf = (request: DispatchNotificationRequest): string =>
  appDeepLinkPath(request.target ? recordLinkTabKey(request.target) : request.link, request.tenantId);

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

  const recipientsOf = async (request: DispatchNotificationRequest, issues: DispatchIssue[]): Promise<NotificationRecipient[]> => {
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

  const toInbox = async (request: DispatchNotificationRequest, recipients: NotificationRecipient[]): Promise<boolean> => {
    const createdAt = deps.now();
    const expiresAt = new Date(createdAt.getTime() + NOTIFICATION_INBOX_RETENTION_DAYS * DAY_MS);
    const documents: InboxNotificationDocument[] = recipients.map((recipient) => ({
      recipientId: recipient.userId,
      title: clip(request.title, NOTIFICATION_TITLE_MAX_LENGTH),
      message: clip(request.message, NOTIFICATION_MESSAGE_MAX_LENGTH),
      params: request.params,
      link: request.link,
      target: request.target ?? null,
      category: request.category ?? '',
      source: request.source,
      read: false,
      createdAt,
      readAt: null,
      expiresAt,
      workflowId: request.workflowId ?? '',
      executionId: request.executionId ?? '',
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
        const message: EmailMessage = renderNotificationEmail({
          to: recipient.email,
          title: clip(resolve(request.title, request.params), NOTIFICATION_TITLE_MAX_LENGTH),
          message: clip(resolve(request.message, request.params), NOTIFICATION_MESSAGE_MAX_LENGTH),
          linkUrl,
          linkLabel: resolve('@core.automation/notifications.email.open', {}),
          footer: resolve('@core.automation/notifications.email.footer', { tenant }),
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
    resolverFor: (locale: string) => Promise<NotificationTextResolver>,
  ): Promise<{ delivered: number; failed: number }> => {
    const payloads = new Map<string, WebPushPayload>();
    for (const recipient of recipients) {
      const resolve = await resolverFor(recipient.locale);
      payloads.set(recipient.userId, {
        title: clip(resolve(request.title, request.params), NOTIFICATION_TITLE_MAX_LENGTH),
        body: clip(resolve(request.message, request.params), NOTIFICATION_TITLE_MAX_LENGTH * 2),
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
      const category = request.category ?? '';
      const wants = (channel: 'inApp' | 'email' | 'push') =>
        request.channels[channel]
          ? recipients.filter((recipient) => recipient.channels[channel] && !isNotificationMuted(recipient.mutes, category, channel))
          : [];

      const inApp = wants('inApp');
      const email = wants('email').filter((recipient) => recipient.email);
      const push = wants('push');

      const [inboxDelivered, emailResult, pushResult] = await Promise.all([
        inApp.length > 0 ? toInbox(request, inApp) : Promise.resolve(true),
        email.length > 0
          ? toEmail(request, email, resolverFor, issues).catch(() => ({ delivered: 0, failed: email.length }))
          : Promise.resolve({ delivered: 0, failed: 0 }),
        push.length > 0
          ? toPush(request, push, resolverFor).catch(() => ({ delivered: 0, failed: push.length }))
          : Promise.resolve({ delivered: 0, failed: 0 }),
      ]);

      if (inboxDelivered) delivered.inApp = inApp.length;
      else failed.inApp = inApp.length;
      delivered.email = emailResult.delivered;
      failed.email = emailResult.failed;
      delivered.push = pushResult.delivered;
      failed.push = pushResult.failed;

      return { recipients: recipients.length, delivered, failed, issues };
    },
  };
};
