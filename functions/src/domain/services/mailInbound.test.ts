import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { WorkflowDefinition } from '../entities/Workflow';
import type { ParsedMail } from '../repositories/IMailReader';
import type { MailDelivery, MailboxRef, StoredMailbox } from '../repositories/IMailboxRepository';
import { EMPTY_MAILBOX_SETTINGS } from '../schema/mailbox';
import type { ForwardingConfirmation, MailboxHealth } from '../schema/mailbox';
import { inboundSignatureIssue, receiveInboundMail } from './mailInbound';
import type { ReceiveInboundDeps } from './mailInbound';

const NOW = new Date('2026-11-14T12:00:00.000Z');
const SECRET = 'segredo-da-instalacao';
const TOKEN = 'abcdefghijklmnopqrstuvwx';
const DOMAIN = 'in.example.com';
const RECIPIENT = `${TOKEN}@${DOMAIN}`;

const sign = (timestamp: string, recipient: string, body: Buffer, secret = SECRET): string =>
  createHmac('sha256', secret).update(`${timestamp}.${recipient}.`).update(body).digest('hex');

describe('inboundSignatureIssue', () => {
  const body = Buffer.from('From: a@b.com\r\n\r\nolá');
  const now = Math.floor(NOW.getTime() / 1000);
  const ts = String(now);

  it('aceita a assinatura certa, com ou sem o prefixo sha256=', () => {
    expect(inboundSignatureIssue(SECRET, { timestamp: ts, recipient: RECIPIENT, signature: sign(ts, RECIPIENT, body) }, body, now)).toBeNull();
    expect(inboundSignatureIssue(SECRET, { timestamp: ts, recipient: RECIPIENT, signature: `sha256=${sign(ts, RECIPIENT, body)}` }, body, now)).toBeNull();
  });

  it('recusa a assinatura feita para outro destinatário — a cópia não troca de caixa', () => {
    const other = `zyxwvutsrqponmlkjihgfedc@${DOMAIN}`;
    expect(inboundSignatureIssue(SECRET, { timestamp: ts, recipient: other, signature: sign(ts, RECIPIENT, body) }, body, now)).toBe('invalid');
  });

  it('recusa segredo errado, corpo alterado, data velha e cabeçalho faltando', () => {
    expect(inboundSignatureIssue(SECRET, { timestamp: ts, recipient: RECIPIENT, signature: sign(ts, RECIPIENT, body, 'outro') }, body, now)).toBe('invalid');
    expect(inboundSignatureIssue(SECRET, { timestamp: ts, recipient: RECIPIENT, signature: sign(ts, RECIPIENT, body) }, Buffer.from('x'), now)).toBe('invalid');
    const old = String(now - 3600);
    expect(inboundSignatureIssue(SECRET, { timestamp: old, recipient: RECIPIENT, signature: sign(old, RECIPIENT, body) }, body, now)).toBe('stale');
    expect(inboundSignatureIssue(SECRET, { timestamp: ts, recipient: RECIPIENT, signature: '' }, body, now)).toBe('missing');
  });
});

const workflow = (id: string, from: string[]): WorkflowDefinition => ({
  id, tenantId: 't', name: id, eventName: 'mail.received', enabled: true, version: 1,
  condition: { kind: 'AlwaysTrue' }, steps: [], mailFilter: { from }, subscribable: true, createdAt: NOW, updatedAt: NOW,
});

const forwardBox = (extra: Partial<StoredMailbox> = {}): StoredMailbox => ({
  tenantId: 't',
  id: 'box',
  ownerId: 'u1',
  settings: { ...EMPTY_MAILBOX_SETTINGS, name: 'Encaminhada', source: 'forward', subscriptions: ['court'] },
  hasPassword: false,
  cursor: null,
  nextPollAt: null,
  health: { lastPolledAt: null, lastDeliveredAt: null, lastDelivered: 0, failure: null },
  inboundToken: TOKEN,
  forwardingConfirmation: null,
  ...extra,
});

const mail = (from: string, subject: string, text = ''): ParsedMail => ({
  messageId: '<m1@x>', from, fromName: '', to: ['pessoa@gmail.com'], cc: [], replyTo: '', subject,
  date: NOW, text, html: '', attachments: [],
});

interface Recorded { ref: MailboxRef; update: { health?: MailboxHealth; forwardingConfirmation?: ForwardingConfirmation | null } }

const deps = (box: StoredMailbox | null, parsed: ParsedMail, delivered: MailDelivery[] = [], recorded: Recorded[] = []): ReceiveInboundDeps => ({
  findByInboundToken: async (token) => (token === TOKEN && box ? { tenantId: 't', id: box.id } : null),
  getMailbox: async () => box,
  mailWorkflows: async () => [workflow('court', ['*.jus.br'])],
  deliver: async (_tenantId, delivery) => { delivered.push(delivery); return 'delivered'; },
  recordInbound: async (ref, update) => { recorded.push({ ref, update }); },
  parse: async () => parsed,
  now: () => NOW,
});

describe('receiveInboundMail', () => {
  it('entrega à automação assinada que quer a mensagem, e registra a chegada', async () => {
    const delivered: MailDelivery[] = [];
    const recorded: Recorded[] = [];
    const outcome = await receiveInboundMail(
      { domain: DOMAIN, recipient: RECIPIENT, raw: Buffer.from('x') },
      deps(forwardBox(), mail('a@tjba.jus.br', 'Intimação'), delivered, recorded),
    );
    expect(outcome).toBe('delivered');
    expect(delivered[0].events.map((event) => event.target)).toEqual(['court']);
    expect(delivered[0].record.source).toEqual({ kind: 'forward', recipient: RECIPIENT });
    expect(recorded[0].update.health?.lastDelivered).toBe(1);
    expect(recorded[0].update.forwardingConfirmation).toBeNull();
  });

  it('o que nenhuma automação quer não é entregue', async () => {
    const delivered: MailDelivery[] = [];
    const outcome = await receiveInboundMail(
      { domain: DOMAIN, recipient: RECIPIENT, raw: Buffer.from('x') },
      deps(forwardBox(), mail('promo@loja.com', 'Ofertas'), delivered),
    );
    expect(outcome).toBe('ignored');
    expect(delivered).toEqual([]);
  });

  it('a confirmação do Gmail vai para a caixa, não para automação', async () => {
    const delivered: MailDelivery[] = [];
    const recorded: Recorded[] = [];
    const outcome = await receiveInboundMail(
      { domain: DOMAIN, recipient: RECIPIENT, raw: Buffer.from('x') },
      deps(forwardBox(), mail('forwarding-noreply@google.com', '(#987654321) Gmail Forwarding Confirmation'), delivered, recorded),
    );
    expect(outcome).toBe('confirmation');
    expect(delivered).toEqual([]);
    expect(recorded[0].update.forwardingConfirmation?.code).toBe('987654321');
  });

  it('destinatário desconhecido, de outro domínio ou de caixa lida por IMAP é descartado sem erro', async () => {
    const parsed = mail('a@tjba.jus.br', 'x');
    expect(await receiveInboundMail({ domain: DOMAIN, recipient: `zyxwvutsrqponmlkjihgfedc@${DOMAIN}`, raw: Buffer.from('x') }, deps(forwardBox(), parsed))).toBe('unknown-recipient');
    expect(await receiveInboundMail({ domain: DOMAIN, recipient: `${TOKEN}@outro.com`, raw: Buffer.from('x') }, deps(forwardBox(), parsed))).toBe('unknown-recipient');
    const imapBox = forwardBox({ settings: { ...forwardBox().settings, source: 'imap' } });
    expect(await receiveInboundMail({ domain: DOMAIN, recipient: RECIPIENT, raw: Buffer.from('x') }, deps(imapBox, parsed))).toBe('unknown-recipient');
  });

  it('caixa desligada não entrega', async () => {
    const box = forwardBox({ settings: { ...forwardBox().settings, enabled: false } });
    expect(await receiveInboundMail({ domain: DOMAIN, recipient: RECIPIENT, raw: Buffer.from('x') }, deps(box, mail('a@tjba.jus.br', 'x')))).toBe('disabled');
  });
});
