import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { WorkflowDefinition } from '../entities/Workflow';
import type { ParsedMail } from '../repositories/IMailReader';
import type { MailDelivery, MailboxRef, StoredMailbox } from '../repositories/IMailboxRepository';
import {
  MAIL_INBOUND_TIMESTAMP_TOLERANCE_SECONDS,
  forwardingConfirmationOf,
  mailInboundTokenOf,
} from '../schema/mailbox';
import type { ForwardingConfirmation, MailboxHealth } from '../schema/mailbox';
import { deliverParsedMail, subscribedWorkflows, withResolvedFilters } from './mailboxPolling';

export type InboundSignatureIssue = 'missing' | 'stale' | 'invalid';

/**
 * A chamada veio do provedor de recepção da instalação? A conta é HMAC-SHA256 de
 * `<timestamp>.<destinatário>.<corpo cru>` com o segredo da instalação: o destinatário entra na conta porque
 * é ele que escolhe a caixa — sem isso, uma mensagem capturada poderia ser reenviada para OUTRA caixa. A data
 * fora da folga recusa a cópia velha.
 */
export const inboundSignatureIssue = (
  secret: string,
  headers: { timestamp: string; recipient: string; signature: string },
  rawBody: Buffer,
  nowSeconds: number,
): InboundSignatureIssue | null => {
  if (!headers.timestamp || !headers.recipient || !headers.signature) return 'missing';
  const timestamp = Number(headers.timestamp);
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > MAIL_INBOUND_TIMESTAMP_TOLERANCE_SECONDS) return 'stale';

  const expected = createHmac('sha256', secret)
    .update(`${headers.timestamp}.${headers.recipient}.`)
    .update(rawBody)
    .digest();
  const received = Buffer.from(headers.signature.trim().replace(/^sha256=/i, ''), 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected) ? null : 'invalid';
};

export type InboundOutcome = 'unknown-recipient' | 'confirmation' | 'disabled' | 'delivered' | 'duplicate' | 'ignored';

export interface ReceiveInboundDeps {
  findByInboundToken: (token: string) => Promise<MailboxRef | null>;
  getMailbox: (ref: MailboxRef) => Promise<StoredMailbox | null>;
  mailWorkflows: (tenantId: string) => Promise<WorkflowDefinition[]>;
  deliver: (tenantId: string, delivery: MailDelivery) => Promise<'delivered' | 'duplicate'>;
  recordInbound: (
    ref: MailboxRef,
    update: { health?: MailboxHealth; forwardingConfirmation?: ForwardingConfirmation | null },
  ) => Promise<void>;
  parse: (raw: Buffer) => Promise<ParsedMail>;
  now: () => Date;
  officeValues?: (tenantId: string) => Promise<Record<string, unknown>>;
}

/**
 * Recebe UMA mensagem encaminhada, já com a assinatura conferida.
 *
 * O destinatário que não é de caixa nenhuma (ou de caixa que não é de encaminhamento) é descartado sem
 * erro: responder diferente ensinaria quais endereços existem, e um erro faria o provedor repetir para
 * sempre. A confirmação do Gmail não vai para automação nenhuma — vai para a tela da caixa.
 */
export const receiveInboundMail = async (
  input: { domain: string; recipient: string; raw: Buffer },
  deps: ReceiveInboundDeps,
): Promise<InboundOutcome> => {
  const token = mailInboundTokenOf(input.recipient, input.domain);
  const ref = token ? await deps.findByInboundToken(token) : null;
  const mailbox = ref ? await deps.getMailbox(ref) : null;
  if (!ref || !mailbox || mailbox.settings.source !== 'forward') return 'unknown-recipient';

  const mail = await deps.parse(input.raw);
  const now = deps.now();
  const confirmation = forwardingConfirmationOf(mail, now);
  if (confirmation) {
    await deps.recordInbound(ref, { forwardingConfirmation: confirmation });
    return 'confirmation';
  }
  if (!mailbox.settings.enabled) return 'disabled';

  const targets = await withResolvedFilters(
    mailbox.tenantId,
    subscribedWorkflows(mailbox, await deps.mailWorkflows(mailbox.tenantId)),
    deps.officeValues,
  );
  const result = await deliverParsedMail(mailbox, targets, mail, deps, {
    fallbackId: `raw:${createHash('sha256').update(input.raw).digest('hex')}`,
    source: { kind: 'forward', recipient: input.recipient },
  });

  // Chegou e-mail de verdade: o encaminhamento está ligado, e a confirmação pendente não diz mais nada.
  await deps.recordInbound(ref, {
    health: {
      lastPolledAt: now.toISOString(),
      lastDeliveredAt: result === 'delivered' ? now.toISOString() : mailbox.health.lastDeliveredAt,
      lastDelivered: result === 'delivered' ? 1 : 0,
      failure: null,
    },
    forwardingConfirmation: null,
  });
  return result;
};
