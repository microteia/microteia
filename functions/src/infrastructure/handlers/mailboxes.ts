import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getDI } from '../di/container';
import { grantedPermissions, requireAnyPermission } from './shared/requirePermission';
import { PERMISSION_MAILBOXES_CONNECT, PERMISSION_MAILBOXES_MANAGE, grants } from '../../domain/schema/access';
import {
  EMPTY_MAILBOX_SETTINGS,
  MAILBOX_POLL_TICK_MINUTES,
  MAILBOX_SOURCES,
  MAIL_INBOUND_HEADERS,
  MAIL_INBOUND_MAX_BYTES,
  MAIL_RECEIVED_EVENT,
  isPolledMailbox,
  mailInboundAddress,
  mailboxSettingsIssue,
} from '../../domain/schema/mailbox';
import type { MailboxListing, MailboxSettings, MailboxView } from '../../domain/schema/mailbox';
import { mailInboundConfig } from '../settings/mailInbound';
import { inboundSignatureIssue, receiveInboundMail } from '../../domain/services/mailInbound';
import { parseMailSource } from '../../data/services/mailParsing';
import { runMailboxPollRound } from '../../domain/services/mailboxPolling';
import type { MailboxRoundDeps } from '../../domain/services/mailboxPolling';
import type { StoredMailbox } from '../../domain/repositories/IMailboxRepository';
import { MailReadError } from '../../domain/repositories/IMailReader';

const REGION = 'southamerica-east1';

/** Caixas por consulta. Uma volta cheia é sinal de fila, e a seguinte começa na hora. */
const POLL_BATCH_SIZE = 25;
/** Depois disso não começa outra caixa: o que sobrar continua vencido e é da execução seguinte. */
const POLL_BUDGET_MS = 420_000;
/** Quantas automações uma caixa alimenta. Cada mensagem vira um evento por automação. */
const MAX_SUBSCRIPTIONS = 20;

const roundDeps = (): MailboxRoundDeps => {
  const di = getDI();
  const repository = di.getMailboxRepository();
  const audit = di.getCreateAuditLogUseCase();
  return {
    reader: di.getMailReader(),
    mailWorkflows: (tenantId) => di.getWorkflowDefinitionRepository().findEnabledByEvent(tenantId, MAIL_RECEIVED_EVENT),
    password: (tenantId, id) => repository.password(tenantId, id),
    deliver: (tenantId, delivery) => repository.deliver(tenantId, delivery),
    now: () => new Date(),
    listDue: (now, limit) => repository.listDue(now, limit),
    claim: (ref, now, leaseUntil) => repository.claim(ref, now, leaseUntil),
    release: (ref, outcome) => repository.release(ref, outcome),
    onFailing: (mailbox, result) => audit.execute({
      tenantId: mailbox.tenantId,
      title: '@core.automation/mailbox.audit.failing',
      titleParams: { name: mailbox.settings.name },
      userId: 'system',
      userName: '',
      photoURL: '',
      action: 'SYSTEM',
      severity: 'CRITICAL',
      type: 'ERROR',
      entity: 'mailboxes',
      entityId: mailbox.id,
      text: `@core.automation/mailbox.failure.${result.outcome.health.failure?.reason ?? 'read'}`,
      textParams: { name: mailbox.settings.name, detail: result.outcome.health.failure?.message ?? '' },
    }),
  };
};

/**
 * Lê as caixas de e-mail de TODOS os escritórios do projeto — um job só, como o relógio das automações,
 * e pela mesma razão: ele não conhece escritório, pergunta quais caixas venceram. Fica fora do
 * `runWorkflowClock` porque uma leitura é rede de outra empresa (segundos, às vezes um timeout): ela não
 * pode atrasar o disparo de horário nem disputar o orçamento dele.
 */
export const pollMailboxes = onSchedule(
  { schedule: `every ${MAILBOX_POLL_TICK_MINUTES} minutes`, region: REGION, timeoutSeconds: 540, memory: '1GiB' },
  async () => {
    const deps = roundDeps();
    const budgetEndsAt = Date.now() + POLL_BUDGET_MS;
    while (Date.now() < budgetEndsAt) {
      const result = await runMailboxPollRound(deps, POLL_BATCH_SIZE, budgetEndsAt);
      if (result.polled > 0) {
        console.log(`[mailboxes] ${result.polled} caixa(s) lida(s), ${result.delivered} mensagem(ns) entregue(s), ${result.failed} falha(s)`);
      }
      // Uma volta que não tomou caixa nenhuma (todas seguras por outra execução) não tem o que repetir.
      if (!result.saturated || result.polled === 0) return;
    }
  },
);

type MailboxOperation = 'list' | 'save' | 'remove' | 'test';

interface ManageMailboxRequest {
  tenantId: string;
  op: MailboxOperation;
  id?: string;
  /** Só na criação: a caixa nasce da pessoa (`own`) ou do escritório (`office`). */
  scope?: 'own' | 'office';
  settings?: Partial<MailboxSettings>;
  /** Ausente ou vazio MANTÉM a senha gravada: o formulário nunca a recebe de volta. */
  password?: string;
}

const textField = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const settingsFrom = (input: Partial<MailboxSettings> | undefined): MailboxSettings => {
  const imap = (input?.imap ?? {}) as Partial<MailboxSettings['imap']>;
  return {
    name: textField(input?.name, 120),
    source: MAILBOX_SOURCES.find((source) => source === input?.source) ?? 'imap',
    imap: {
      host: textField(imap.host, 255),
      port: typeof imap.port === 'number' ? imap.port : EMPTY_MAILBOX_SETTINGS.imap.port,
      secure: imap.secure !== false,
      username: textField(imap.username, 320),
      folder: textField(imap.folder, 255) || EMPTY_MAILBOX_SETTINGS.imap.folder,
    },
    pollEveryMinutes: typeof input?.pollEveryMinutes === 'number' ? input.pollEveryMinutes : EMPTY_MAILBOX_SETTINGS.pollEveryMinutes,
    subscriptions: [...new Set((Array.isArray(input?.subscriptions) ? input.subscriptions : []).filter((id): id is string => typeof id === 'string' && id !== ''))],
    enabled: input?.enabled !== false,
  };
};

const viewOf = async (
  tenantId: string,
  mailbox: StoredMailbox,
  names: Map<string, string>,
  inboundDomain: string | null,
): Promise<MailboxView> => {
  if (mailbox.ownerId && !names.has(mailbox.ownerId)) {
    names.set(mailbox.ownerId, (await getDI().getTenantMemberRepository().getMember(tenantId, mailbox.ownerId))?.displayName ?? '');
  }
  return {
    ...mailbox.settings,
    id: mailbox.id,
    ownerId: mailbox.ownerId,
    ownerName: mailbox.ownerId ? names.get(mailbox.ownerId) || null : null,
    hasPassword: mailbox.hasPassword,
    nextPollAt: mailbox.nextPollAt ? mailbox.nextPollAt.toISOString() : null,
    health: mailbox.health,
    address: mailbox.inboundToken && inboundDomain ? mailInboundAddress(mailbox.inboundToken, inboundDomain) : null,
    forwardingConfirmation: mailbox.forwardingConfirmation,
  };
};

/**
 * As automações que esta caixa pode alimentar. A de um membro só alimenta as que o escritório marcou como
 * assináveis: a automação é de quem a escreveu, e nem toda está pronta para o e-mail pessoal de qualquer um.
 */
const subscriptionIssue = async (tenantId: string, ownerId: string | null, subscriptions: string[]): Promise<string | null> => {
  if (subscriptions.length > MAX_SUBSCRIPTIONS) return '@core.automation/mailbox.issue.too-many-subscriptions';
  const repository = getDI().getWorkflowDefinitionRepository();
  for (const id of subscriptions) {
    const workflow = await repository.findById(tenantId, id);
    if (!workflow || workflow.eventName !== MAIL_RECEIVED_EVENT) return '@core.automation/mailbox.issue.subscription-invalid';
    if (ownerId !== null && workflow.subscribable !== true) return '@core.automation/mailbox.issue.subscription-not-subscribable';
  }
  return null;
};

/**
 * As caixas de e-mail — a única porta pela qual elas são lidas ou gravadas. Nenhum cliente toca a coleção:
 * o mesmo documento guarda o ponto de leitura e o prazo da próxima, que o navegador não pode escrever.
 *
 * Quem tem `mailboxes.connect` vê e configura a PRÓPRIA; quem tem `mailboxes.manage`, todas e as do
 * escritório. A senha entra e nunca sai.
 */
export const manageMailbox = onCall(
  { region: REGION, cors: true, timeoutSeconds: 120 },
  async (request): Promise<MailboxListing | { id: string } | { ok: true }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    const { tenantId, op, id, scope, settings, password } = (request.data ?? {}) as ManageMailboxRequest;
    if (!tenantId) throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');

    const userId = request.auth.uid;
    await requireAnyPermission(tenantId, request.auth, [PERMISSION_MAILBOXES_CONNECT, PERMISSION_MAILBOXES_MANAGE]);
    const canManage = grants(await grantedPermissions(tenantId, userId), PERMISSION_MAILBOXES_MANAGE);
    const repository = getDI().getMailboxRepository();

    const reachable = async (mailboxId: string | undefined): Promise<StoredMailbox> => {
      const mailbox = mailboxId ? await repository.get(tenantId, mailboxId) : null;
      // A caixa de outra pessoa responde igual à que não existe: um "não pode" ensinaria quais ids existem.
      if (!mailbox || (!canManage && mailbox.ownerId !== userId)) {
        throw new HttpsError('not-found', '@core.automation/mailbox.not-found');
      }
      return mailbox;
    };

    switch (op) {
      case 'list': {
        const names = new Map<string, string>();
        const inbound = mailInboundConfig();
        const all = await repository.listForTenant(tenantId);
        const visible = all.filter((mailbox) => canManage || mailbox.ownerId === userId);
        return {
          mailboxes: await Promise.all(visible.map((mailbox) => viewOf(tenantId, mailbox, names, inbound?.domain ?? null))),
          forwardingAvailable: inbound !== null,
        };
      }
      case 'save': {
        const existing = id ? await reachable(id) : null;
        const ownerId = existing ? existing.ownerId : scope === 'office' ? null : userId;
        if (ownerId === null && !canManage) throw new HttpsError('permission-denied', '@core.access/permission.denied', { permission: PERMISSION_MAILBOXES_MANAGE });

        const next = settingsFrom(settings);
        const issue = mailboxSettingsIssue(next) ?? await subscriptionIssue(tenantId, ownerId, next.subscriptions);
        if (issue) throw new HttpsError('invalid-argument', issue);
        // A caixa de encaminhamento não guarda senha nenhuma; a lida por IMAP não lê sem ela.
        const polled = isPolledMailbox(next.source);
        const typed = polled && typeof password === 'string' && password !== '' ? password.slice(0, 1024) : null;
        if (polled && typed === null && !existing?.hasPassword) throw new HttpsError('invalid-argument', '@core.automation/mailbox.issue.password');
        if (!polled && mailInboundConfig() === null) throw new HttpsError('failed-precondition', '@core.automation/mailbox.issue.forwarding-unavailable');

        const savedId = await repository.save({ tenantId, id: existing?.id ?? null, ownerId, settings: next, password: typed, actorId: userId, now: new Date() });
        return { id: savedId };
      }
      case 'remove': {
        const mailbox = await reachable(id);
        await repository.remove(tenantId, mailbox.id);
        return { ok: true };
      }
      case 'test': {
        // Testa o que está GRAVADO: um teste com servidor e senha livres faria desta callable um sondador
        // de credenciais em servidor alheio, pago pela instalação.
        const mailbox = await reachable(id);
        if (!isPolledMailbox(mailbox.settings.source)) throw new HttpsError('invalid-argument', '@core.automation/mailbox.op.invalid');
        const secret = await repository.password(tenantId, mailbox.id);
        if (!secret) throw new HttpsError('failed-precondition', '@core.automation/mailbox.failure.auth', { name: mailbox.settings.name, detail: '' });
        try {
          const session = await getDI().getMailReader().open(mailbox.settings.imap, secret);
          await session.close();
        } catch (error) {
          const reason = error instanceof MailReadError ? error.reason : 'read';
          throw new HttpsError('failed-precondition', `@core.automation/mailbox.failure.${reason}`, {
            name: mailbox.settings.name,
            detail: error instanceof Error ? error.message.slice(0, 300) : '',
          });
        }
        return { ok: true };
      }
      default:
        throw new HttpsError('invalid-argument', '@core.automation/mailbox.op.invalid');
    }
  },
);

const headerOf = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] ?? '' : value ?? '');

/**
 * A ENTRADA do e-mail encaminhado: o adaptador do provedor de recepção (Cloudflare Email Workers, Postmark,
 * Mailgun, SES…) faz `POST` da mensagem crua (RFC 822) com o destinatário do envelope e a assinatura nos
 * cabeçalhos `MAIL_INBOUND_HEADERS`. O kernel não conhece provedor nenhum: conhece a mensagem e a assinatura.
 *
 * Responde 202 a toda mensagem assinada, entregue ou não — inclusive à de endereço que não existe: o
 * provedor repete o que recebe erro, e um 404 ensinaria quais endereços existem. Erro de verdade (o banco
 * fora) é 500, e o reenvio é seguro: a marca de `mail_messages` não deixa entregar duas vezes.
 */
export const mailInbound = onRequest(
  { region: REGION, cors: false, timeoutSeconds: 120, memory: '1GiB' },
  async (request, response): Promise<void> => {
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Use POST with the raw message.' });
      return;
    }
    const config = mailInboundConfig();
    if (!config) {
      response.status(404).json({ error: 'Forwarding is not configured on this installation.' });
      return;
    }
    const length = Number(request.headers['content-length'] ?? '0');
    const raw = request.rawBody ?? Buffer.alloc(0);
    if ((Number.isFinite(length) && length > MAIL_INBOUND_MAX_BYTES) || raw.length > MAIL_INBOUND_MAX_BYTES) {
      response.status(413).json({ error: 'Message too large.', limit: MAIL_INBOUND_MAX_BYTES });
      return;
    }

    const recipient = headerOf(request.headers[MAIL_INBOUND_HEADERS.recipient]).trim();
    const issue = inboundSignatureIssue(
      config.secret,
      {
        timestamp: headerOf(request.headers[MAIL_INBOUND_HEADERS.timestamp]).trim(),
        recipient,
        signature: headerOf(request.headers[MAIL_INBOUND_HEADERS.signature]).trim(),
      },
      raw,
      Math.floor(Date.now() / 1000),
    );
    if (issue) {
      response.status(401).json({ error: `signature-${issue}` });
      return;
    }

    const di = getDI();
    const repository = di.getMailboxRepository();
    try {
      const outcome = await receiveInboundMail(
        { domain: config.domain, recipient, raw },
        {
          findByInboundToken: (token) => repository.findByInboundToken(token),
          getMailbox: (ref) => repository.get(ref.tenantId, ref.id),
          mailWorkflows: (tenantId) => di.getWorkflowDefinitionRepository().findEnabledByEvent(tenantId, MAIL_RECEIVED_EVENT),
          deliver: (tenantId, delivery) => repository.deliver(tenantId, delivery),
          recordInbound: (ref, update) => repository.recordInbound(ref, update),
          parse: parseMailSource,
          now: () => new Date(),
        },
      );
      response.status(202).json({ outcome });
    } catch (error) {
      console.error('[mail-inbound] Falha ao receber mensagem encaminhada:', error);
      response.status(500).json({ error: 'internal' });
    }
  },
);
