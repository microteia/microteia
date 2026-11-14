import { createHash } from 'node:crypto';
import type { WorkflowDefinition } from '../entities/Workflow';
import type { IMailReader, MailEnvelope, MailReadSession, ParsedMail } from '../repositories/IMailReader';
import { MailReadError } from '../repositories/IMailReader';
import type { MailDelivery, MailboxCursor, MailboxPollOutcome, StoredMailbox } from '../repositories/IMailboxRepository';
import {
  MAILBOX_MAX_MESSAGES_PER_POLL,
  MAIL_HTML_MAX_CHARS,
  MAIL_RECEIVED_EVENT,
  MAIL_TEXT_MAX_CHARS,
  mailMessageExpiresAt,
  mailServerPrefilter,
  matchesMailFilter,
} from '../schema/mailbox';
import type { MailEventPayload, MailboxFailureReason, MailboxHealth } from '../schema/mailbox';

const MINUTE_MS = 60_000;

/**
 * Quanto antes da última leitura o reinício pela data recomeça quando o servidor troca os UIDs. O `SINCE`
 * do IMAP é por DIA, sem hora nem fuso: a folga cobre a virada do dia no fuso do servidor, e a marca de
 * `mail_messages` impede que o que já foi entregue seja entregue de novo.
 */
const RESYNC_MARGIN_MS = 24 * 60 * MINUTE_MS;

export interface PollMailboxDeps {
  reader: IMailReader;
  /** As automações ligadas de e-mail do escritório. */
  mailWorkflows: (tenantId: string) => Promise<WorkflowDefinition[]>;
  password: (tenantId: string, id: string) => Promise<string | null>;
  deliver: (tenantId: string, delivery: MailDelivery) => Promise<'delivered' | 'duplicate'>;
  now: () => Date;
}

/**
 * As automações que esta caixa alimenta: as assinadas, ligadas, de e-mail — e, na caixa de um MEMBRO,
 * só as marcadas como assináveis. A marca é conferida aqui, e não só ao salvar: a automação que deixa de
 * ser assinável para de receber o e-mail pessoal na leitura seguinte, sem ninguém editar a caixa.
 */
export const subscribedWorkflows = (mailbox: StoredMailbox, workflows: WorkflowDefinition[]): WorkflowDefinition[] =>
  workflows.filter((workflow) =>
    workflow.enabled
    && workflow.eventName === MAIL_RECEIVED_EVENT
    && mailbox.settings.subscriptions.includes(workflow.id)
    && (mailbox.ownerId === null || workflow.subscribable === true));

/**
 * A identidade da mensagem NA CAIXA. O `Message-ID` é o que sobrevive à troca de UIDs e o que é igual
 * nas cópias da mesma mensagem; a mensagem sem ele (rara, e fora da norma) fica com a posição.
 */
export const mailMessageKey = (mailboxId: string, messageId: string, fallback: string): string =>
  createHash('sha256').update(`${mailboxId}\n${messageId.trim() || fallback}`).digest('hex');

/** Um evento por (mensagem, automação), com id fixo: a mesma entrega repetida não acorda ninguém duas vezes. */
export const mailEventId = (key: string, workflowId: string): string => `mail_${key.slice(0, 40)}_${workflowId}`;

const cut = (value: string, max: number): { value: string; cut: boolean } =>
  value.length > max ? { value: value.slice(0, max), cut: true } : { value, cut: false };

export const mailEventPayload = (
  key: string,
  mailbox: StoredMailbox,
  mail: ParsedMail,
  receivedAt: Date,
): MailEventPayload => {
  const text = cut(mail.text, MAIL_TEXT_MAX_CHARS);
  const html = cut(mail.html, MAIL_HTML_MAX_CHARS);
  return {
    id: key,
    mailboxId: mailbox.id,
    mailboxOwnerId: mailbox.ownerId,
    messageId: mail.messageId,
    from: mail.from,
    fromName: mail.fromName,
    to: mail.to,
    cc: mail.cc,
    replyTo: mail.replyTo,
    subject: mail.subject,
    date: (mail.date ?? receivedAt).toISOString(),
    text: text.value,
    html: html.value,
    truncated: text.cut || html.cut,
    attachments: mail.attachments,
  };
};

const healthy = (previous: MailboxHealth, now: Date, delivered: number): MailboxHealth => ({
  lastPolledAt: now.toISOString(),
  lastDeliveredAt: delivered > 0 ? now.toISOString() : previous.lastDeliveredAt,
  lastDelivered: delivered,
  failure: null,
});

const failed = (previous: MailboxHealth, now: Date, reason: MailboxFailureReason, message: string): MailboxHealth => ({
  ...previous,
  lastPolledAt: now.toISOString(),
  failure: { reason, message: message.slice(0, 500), at: now.toISOString() },
});

const nextPoll = (mailbox: StoredMailbox, now: Date): Date =>
  new Date(now.getTime() + mailbox.settings.pollEveryMinutes * MINUTE_MS);

export interface PollMailboxResult {
  outcome: MailboxPollOutcome;
  delivered: number;
  duplicates: number;
  /** A caixa passou de saudável a falhando nesta leitura — é quando vale avisar alguém. */
  newlyFailing: boolean;
}

/**
 * Lê uma caixa já tomada (`claim`) e diz o que gravar nela.
 *
 * - A primeira leitura NÃO é retroativa: marca o ponto e não entrega nada. Ligar a caixa a uma automação
 *   não pode despejar nela o histórico de anos.
 * - Sem automação assinada, não conecta: zera o ponto, e a próxima assinatura começa do zero.
 * - Só baixa o corpo do que alguma automação quer; o resto da caixa é visto só pelo cabeçalho, e nada dele
 *   é gravado.
 * - O ponto avança só sobre o que foi entregue: a falha no meio recomeça da mensagem que falhou.
 */
export const pollMailbox = async (mailbox: StoredMailbox, deps: PollMailboxDeps): Promise<PollMailboxResult> => {
  const now = deps.now();
  const wasHealthy = mailbox.health.failure === null;
  const idle = (cursor: MailboxCursor | null): PollMailboxResult => ({
    outcome: { cursor, nextPollAt: nextPoll(mailbox, now), health: healthy(mailbox.health, now, 0) },
    delivered: 0,
    duplicates: 0,
    newlyFailing: false,
  });
  const failure = (reason: MailboxFailureReason, message: string, cursor: MailboxCursor | null): PollMailboxResult => ({
    outcome: { cursor, nextPollAt: nextPoll(mailbox, now), health: failed(mailbox.health, now, reason, message) },
    delivered: 0,
    duplicates: 0,
    newlyFailing: wasHealthy,
  });

  if (!mailbox.settings.enabled) return idle(mailbox.cursor);
  const targets = subscribedWorkflows(mailbox, await deps.mailWorkflows(mailbox.tenantId));
  if (targets.length === 0) return idle(null);

  const password = await deps.password(mailbox.tenantId, mailbox.id);
  if (!password) return failure('auth', 'no password', mailbox.cursor);

  let session: MailReadSession;
  try {
    session = await deps.reader.open(mailbox.settings.imap, password);
  } catch (error) {
    return failure(reasonOf(error), messageOf(error), mailbox.cursor);
  }

  let cursor = mailbox.cursor;
  let delivered = 0;
  let duplicates = 0;
  try {
    const { status } = session;
    if (!cursor) {
      return idle({ uidValidity: status.uidValidity, lastUid: status.uidNext - 1 });
    }

    const prefilter = mailServerPrefilter(targets.map((workflow) => workflow.mailFilter));
    const resync = cursor.uidValidity !== status.uidValidity;
    const since = new Date(Date.parse(mailbox.health.lastPolledAt ?? now.toISOString()) - RESYNC_MARGIN_MS);
    const envelopes = resync
      ? await session.listSince(since, prefilter, MAILBOX_MAX_MESSAGES_PER_POLL + 1)
      : await session.listAfter(cursor.lastUid, prefilter, MAILBOX_MAX_MESSAGES_PER_POLL + 1);
    const saturated = envelopes.length > MAILBOX_MAX_MESSAGES_PER_POLL;
    const batch = envelopes.slice(0, MAILBOX_MAX_MESSAGES_PER_POLL);

    let lastUid = resync ? 0 : cursor.lastUid;
    for (const envelope of batch) {
      const result = await deliverEnvelope(mailbox, targets, envelope, session, deps, status.uidValidity);
      if (result === 'delivered') delivered += 1;
      if (result === 'duplicate') duplicates += 1;
      lastUid = Math.max(lastUid, envelope.uid);
      cursor = { uidValidity: status.uidValidity, lastUid };
    }
    // Sem fila para trás, o ponto vai até onde o servidor já numerou: a busca filtrada não devolve o que
    // não casa, e recomeçar abaixo disso repetiria a mesma busca vazia a cada volta.
    if (!saturated) cursor = { uidValidity: status.uidValidity, lastUid: Math.max(lastUid, status.uidNext - 1) };

    return {
      outcome: {
        cursor,
        nextPollAt: saturated ? now : nextPoll(mailbox, now),
        health: healthy(mailbox.health, now, delivered),
      },
      delivered,
      duplicates,
      newlyFailing: false,
    };
  } catch (error) {
    const result = failure(reasonOf(error), messageOf(error), cursor);
    return { ...result, delivered, duplicates };
  } finally {
    await session.close().catch(() => undefined);
  }
};

const deliverEnvelope = async (
  mailbox: StoredMailbox,
  targets: WorkflowDefinition[],
  envelope: MailEnvelope,
  session: MailReadSession,
  deps: PollMailboxDeps,
  uidValidity: string,
): Promise<'delivered' | 'duplicate' | 'ignored'> => {
  if (!targets.some((workflow) => matchesMailFilter(workflow.mailFilter, envelope))) return 'ignored';

  const mail = await session.fetch(envelope.uid);
  // O corpo inteiro diz mais que o cabeçalho (os anexos, sobretudo): quem recebe é decidido de novo.
  const subject = { from: mail.from, subject: mail.subject, attachmentCount: mail.attachments.length };
  const wanted = targets.filter((workflow) => matchesMailFilter(workflow.mailFilter, subject));
  if (wanted.length === 0) return 'ignored';

  const receivedAt = deps.now();
  const key = mailMessageKey(mailbox.id, mail.messageId || envelope.messageId, `uid:${uidValidity}:${envelope.uid}`);
  const payload = mailEventPayload(key, mailbox, mail, receivedAt);
  return deps.deliver(mailbox.tenantId, {
    key,
    record: {
      mailboxId: mailbox.id,
      mailboxOwnerId: mailbox.ownerId,
      messageId: payload.messageId,
      from: payload.from,
      subject: payload.subject,
      date: payload.date,
      workflowIds: wanted.map((workflow) => workflow.id),
      source: { folder: mailbox.settings.imap.folder, uidValidity, uid: envelope.uid },
      receivedAt,
      expiresAt: mailMessageExpiresAt(receivedAt),
    },
    events: wanted.map((workflow) => ({ id: mailEventId(key, workflow.id), target: workflow.id, payload })),
  });
};

const reasonOf = (error: unknown): MailboxFailureReason => (error instanceof MailReadError ? error.reason : 'read');
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export interface MailboxRoundDeps extends PollMailboxDeps {
  listDue: (now: Date, limit: number) => Promise<Array<{ tenantId: string; id: string }>>;
  claim: (ref: { tenantId: string; id: string }, now: Date, leaseUntil: Date) => Promise<StoredMailbox | null>;
  release: (ref: { tenantId: string; id: string }, outcome: MailboxPollOutcome) => Promise<void>;
  /** A caixa passou a falhar. Só nessa passagem: uma caixa com a senha errada não avisa a cada 15 minutos. */
  onFailing: (mailbox: StoredMailbox, result: PollMailboxResult) => Promise<void>;
}

export interface MailboxRoundResult {
  polled: number;
  delivered: number;
  failed: number;
  /** A consulta veio cheia: há mais caixas vencidas que o lote. */
  saturated: boolean;
}

/**
 * Por quanto tempo uma leitura segura a caixa. Maior que o tempo máximo da função: a execução que morre
 * no meio solta a caixa sozinha quando o prazo vence, e nenhuma outra a lê enquanto a primeira vive.
 */
export const MAILBOX_LEASE_MS = 10 * MINUTE_MS;

/** Uma volta da leitura: as caixas vencidas, uma de cada vez, até o lote ou o orçamento acabar. */
export const runMailboxPollRound = async (
  deps: MailboxRoundDeps,
  batchSize: number,
  budgetEndsAt: number,
): Promise<MailboxRoundResult> => {
  const due = await deps.listDue(deps.now(), batchSize);
  const result: MailboxRoundResult = { polled: 0, delivered: 0, failed: 0, saturated: due.length === batchSize };
  for (const ref of due) {
    if (Date.now() >= budgetEndsAt) {
      result.saturated = true;
      break;
    }
    const now = deps.now();
    const mailbox = await deps.claim(ref, now, new Date(now.getTime() + MAILBOX_LEASE_MS));
    if (!mailbox) continue;
    const polled = await pollMailbox(mailbox, deps);
    await deps.release(ref, polled.outcome);
    result.polled += 1;
    result.delivered += polled.delivered;
    if (polled.outcome.health.failure) {
      result.failed += 1;
      if (polled.newlyFailing) await deps.onFailing(mailbox, polled).catch(() => undefined);
    }
  }
  return result;
};
