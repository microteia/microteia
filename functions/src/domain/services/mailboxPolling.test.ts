import { describe, expect, it } from 'vitest';
import type { WorkflowDefinition } from '../entities/Workflow';
import type { MailEnvelope, MailReadSession, ParsedMail } from '../repositories/IMailReader';
import { MailReadError } from '../repositories/IMailReader';
import type { MailDelivery, StoredMailbox } from '../repositories/IMailboxRepository';
import { EMPTY_MAILBOX_SETTINGS, MAILBOX_MAX_MESSAGES_PER_POLL } from '../schema/mailbox';
import type { MailFilter, MailServerPrefilter } from '../schema/mailbox';
import { mailEventId, mailMessageKey, pollMailbox, subscribedWorkflows } from './mailboxPolling';
import type { PollMailboxDeps } from './mailboxPolling';

const NOW = new Date('2026-11-14T12:00:00.000Z');

const workflow = (id: string, mailFilter: MailFilter | null, extra: Partial<WorkflowDefinition> = {}): WorkflowDefinition => ({
  id,
  tenantId: 't',
  name: id,
  eventName: 'mail.received',
  enabled: true,
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [],
  mailFilter,
  subscribable: true,
  createdAt: NOW,
  updatedAt: NOW,
  ...extra,
});

const mailbox = (extra: Partial<StoredMailbox> = {}): StoredMailbox => ({
  tenantId: 't',
  id: 'box',
  ownerId: 'u1',
  settings: { ...EMPTY_MAILBOX_SETTINGS, name: 'Box', subscriptions: ['court', 'invoices'] },
  hasPassword: true,
  cursor: { uidValidity: 'v1', lastUid: 10 },
  nextPollAt: NOW,
  health: { lastPolledAt: '2026-11-14T11:45:00.000Z', lastDeliveredAt: null, lastDelivered: 0, failure: null },
  inboundToken: null,
  forwardingConfirmation: null,
  ...extra,
});

interface StoredMessage extends MailEnvelope {
  attachments?: number;
}

const fakeSession = (
  messages: StoredMessage[],
  status = { uidValidity: 'v1', uidNext: 100 },
  calls: { listed: Array<{ kind: string; prefilter: MailServerPrefilter }>; fetched: number[] } = { listed: [], fetched: [] },
): MailReadSession => ({
  status,
  listAfter: async (afterUid, prefilter, limit) => {
    calls.listed.push({ kind: 'after', prefilter });
    return messages.filter((message) => message.uid > afterUid).slice(0, limit);
  },
  listSince: async (_since, prefilter, limit) => {
    calls.listed.push({ kind: 'since', prefilter });
    return messages.slice(0, limit);
  },
  fetch: async (uid) => {
    calls.fetched.push(uid);
    const message = messages.find((one) => one.uid === uid)!;
    const parsed: ParsedMail = {
      messageId: message.messageId,
      from: message.from,
      fromName: '',
      to: ['me@x.com'],
      cc: [],
      replyTo: '',
      subject: message.subject,
      date: NOW,
      text: 'body',
      html: '',
      attachments: Array.from({ length: message.attachments ?? 0 }, (_, i) => ({ name: `a${i}.pdf`, contentType: 'application/pdf', size: 1 })),
    };
    return parsed;
  },
  close: async () => undefined,
});

const envelope = (uid: number, from: string, subject: string, attachments = 0): StoredMessage => ({
  uid, messageId: `<m${uid}@x>`, from, subject, attachmentCount: attachments, attachments,
});

const deps = (
  session: MailReadSession | (() => Promise<MailReadSession>),
  workflows: WorkflowDefinition[],
  delivered: MailDelivery[] = [],
  seen = new Set<string>(),
): PollMailboxDeps => ({
  reader: { open: async () => (typeof session === 'function' ? session() : session) },
  mailWorkflows: async () => workflows,
  password: async () => 'secret',
  deliver: async (_tenantId, delivery) => {
    if (seen.has(delivery.key)) return 'duplicate';
    seen.add(delivery.key);
    delivered.push(delivery);
    return 'delivered';
  },
  now: () => NOW,
});

const court = workflow('court', { from: ['*.jus.br'] });
const invoices = workflow('invoices', { subject: ['fatura'] });

describe('subscribedWorkflows', () => {
  it('na caixa de um membro, só as assinadas, ligadas e assináveis', () => {
    const notSubscribable = workflow('invoices', null, { subscribable: false });
    const off = workflow('court', null, { enabled: false });
    expect(subscribedWorkflows(mailbox(), [court, notSubscribable, workflow('other', null)]).map((w) => w.id)).toEqual(['court']);
    expect(subscribedWorkflows(mailbox(), [off])).toEqual([]);
  });

  it('na caixa do escritório, a marca de assinável não é exigida', () => {
    const notSubscribable = workflow('invoices', null, { subscribable: false });
    expect(subscribedWorkflows(mailbox({ ownerId: null }), [notSubscribable]).map((w) => w.id)).toEqual(['invoices']);
  });
});

describe('pollMailbox', () => {
  it('a primeira leitura marca o ponto e não entrega nada', async () => {
    const delivered: MailDelivery[] = [];
    const result = await pollMailbox(
      mailbox({ cursor: null }),
      deps(fakeSession([envelope(5, 'a@tjba.jus.br', 'x')]), [court], delivered),
    );
    expect(delivered).toEqual([]);
    expect(result.outcome.cursor).toEqual({ uidValidity: 'v1', lastUid: 99 });
  });

  it('sem automação assinada, não conecta e zera o ponto', async () => {
    let opened = false;
    const result = await pollMailbox(mailbox(), {
      ...deps(fakeSession([]), []),
      reader: { open: async () => { opened = true; return fakeSession([]); } },
    });
    expect(opened).toBe(false);
    expect(result.outcome.cursor).toBeNull();
  });

  it('entrega a mesma mensagem às duas automações que a querem, com um evento de id fixo para cada', async () => {
    const delivered: MailDelivery[] = [];
    const calls = { listed: [] as Array<{ kind: string; prefilter: MailServerPrefilter }>, fetched: [] as number[] };
    const session = fakeSession([
      envelope(11, 'a@tjba.jus.br', 'Fatura de outubro'),
      envelope(12, 'promo@loja.com', 'Ofertas'),
      envelope(13, 'b@trt5.jus.br', 'Intimação'),
    ], { uidValidity: 'v1', uidNext: 14 }, calls);

    const result = await pollMailbox(mailbox(), deps(session, [court, invoices], delivered));

    expect(result.delivered).toBe(2);
    expect(calls.fetched).toEqual([11, 13]);
    expect(delivered[0].events.map((event) => event.target)).toEqual(['court', 'invoices']);
    expect(delivered[1].events.map((event) => event.target)).toEqual(['court']);
    const key = mailMessageKey('box', '<m11@x>', '');
    expect(delivered[0].key).toBe(key);
    expect(delivered[0].events[0].id).toBe(mailEventId(key, 'court'));
    expect(result.outcome.cursor).toEqual({ uidValidity: 'v1', lastUid: 13 });
    expect(result.outcome.nextPollAt?.getTime()).toBe(NOW.getTime() + 15 * 60_000);
  });

  it('pede ao servidor só a dimensão que todas as automações restringem', async () => {
    const calls = { listed: [] as Array<{ kind: string; prefilter: MailServerPrefilter }>, fetched: [] as number[] };
    await pollMailbox(mailbox(), deps(fakeSession([], undefined, calls), [court]));
    expect(calls.listed[0].prefilter).toEqual({ kind: 'from', terms: ['jus.br'] });
  });

  it('o anexo decide no corpo: o cabeçalho que não sabe contar anexos não entrega a quem exige anexo sem conferir', async () => {
    const delivered: MailDelivery[] = [];
    const withAttachment = workflow('court', { from: ['*.jus.br'], hasAttachments: true });
    const message = { ...envelope(11, 'a@tjba.jus.br', 'x', 1), attachmentCount: 1 };
    await pollMailbox(mailbox(), deps(fakeSession([message]), [withAttachment], delivered));
    expect(delivered).toHaveLength(1);
  });

  it('a mensagem já entregue conta como repetida e não publica de novo', async () => {
    const delivered: MailDelivery[] = [];
    const seen = new Set([mailMessageKey('box', '<m11@x>', '')]);
    const result = await pollMailbox(mailbox(), deps(fakeSession([envelope(11, 'a@tjba.jus.br', 'x')]), [court], delivered, seen));
    expect(result.duplicates).toBe(1);
    expect(delivered).toEqual([]);
  });

  it('com mais mensagens que o teto, entrega o teto e volta na hora', async () => {
    const many = Array.from({ length: MAILBOX_MAX_MESSAGES_PER_POLL + 5 }, (_, i) => envelope(11 + i, 'a@tjba.jus.br', 'x'));
    const result = await pollMailbox(mailbox(), deps(fakeSession(many, { uidValidity: 'v1', uidNext: 500 }), [court]));
    expect(result.delivered).toBe(MAILBOX_MAX_MESSAGES_PER_POLL);
    expect(result.outcome.nextPollAt).toEqual(NOW);
    expect(result.outcome.cursor?.lastUid).toBe(10 + MAILBOX_MAX_MESSAGES_PER_POLL);
  });

  it('o servidor trocou os UIDs: recomeça pela data, e a marca impede a entrega repetida', async () => {
    const calls = { listed: [] as Array<{ kind: string; prefilter: MailServerPrefilter }>, fetched: [] as number[] };
    const seen = new Set([mailMessageKey('box', '<m3@x>', '')]);
    const session = fakeSession(
      [envelope(3, 'a@tjba.jus.br', 'x'), envelope(4, 'b@tjba.jus.br', 'y')],
      { uidValidity: 'v2', uidNext: 5 },
      calls,
    );
    const result = await pollMailbox(mailbox(), deps(session, [court], [], seen));
    expect(calls.listed[0].kind).toBe('since');
    expect(result.delivered).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.outcome.cursor).toEqual({ uidValidity: 'v2', lastUid: 4 });
  });

  it('falha no meio: o ponto fica na última entregue, e a falha é dita uma vez', async () => {
    const session = fakeSession([envelope(11, 'a@tjba.jus.br', 'x'), envelope(12, 'b@tjba.jus.br', 'y')]);
    const failing: MailReadSession = {
      ...session,
      fetch: async (uid) => {
        if (uid === 12) throw new MailReadError('read', 'boom');
        return session.fetch(uid);
      },
    };
    const result = await pollMailbox(mailbox(), deps(failing, [court]));
    expect(result.delivered).toBe(1);
    expect(result.outcome.cursor).toEqual({ uidValidity: 'v1', lastUid: 11 });
    expect(result.outcome.health.failure?.reason).toBe('read');
    expect(result.newlyFailing).toBe(true);

    const again = await pollMailbox(mailbox({ health: result.outcome.health }), deps(failing, [court]));
    expect(again.newlyFailing).toBe(false);
  });

  it('a senha recusada vira falha de autenticação, sem mexer no ponto', async () => {
    const result = await pollMailbox(mailbox(), deps(async () => { throw new MailReadError('auth', 'invalid credentials'); }, [court]));
    expect(result.outcome.health.failure?.reason).toBe('auth');
    expect(result.outcome.cursor).toEqual({ uidValidity: 'v1', lastUid: 10 });
  });

  it('a caixa que virou de encaminhamento sai da fila de leitura sem conectar', async () => {
    let opened = false;
    const box = mailbox({ settings: { ...mailbox().settings, source: 'forward' } });
    const result = await pollMailbox(box, { ...deps(fakeSession([]), [court]), reader: { open: async () => { opened = true; return fakeSession([]); } } });
    expect(opened).toBe(false);
    expect(result.outcome.nextPollAt).toBeNull();
  });

  it('a primeira leitura com janela entrega os últimos dias e continua do maior UID', async () => {
    const delivered: MailDelivery[] = [];
    const calls = { listed: [] as Array<{ kind: string; prefilter: MailServerPrefilter }>, fetched: [] as number[] };
    const box = mailbox({ cursor: null, settings: { ...mailbox().settings, backfillDays: 3 } });
    const session = fakeSession([envelope(7, 'a@tjba.jus.br', 'x'), envelope(8, 'promo@loja.com', 'y')], { uidValidity: 'v1', uidNext: 9 }, calls);
    const result = await pollMailbox(box, deps(session, [court], delivered));
    expect(calls.listed[0].kind).toBe('since');
    expect(delivered).toHaveLength(1);
    expect(result.outcome.cursor).toEqual({ uidValidity: 'v1', lastUid: 8 });
  });

  it('o filtro que cita configuração do escritório usa a lista dela', async () => {
    const delivered: MailDelivery[] = [];
    const fromSetting = workflow('court', { from: ['*.jus.br'], fromSetting: 'push.allowedSenders' });
    const session = fakeSession([envelope(11, 'a@tjba.jus.br', 'x'), envelope(12, 'b@trt5.jus.br', 'y')]);
    const result = await pollMailbox(mailbox(), {
      ...deps(session, [fromSetting], delivered),
      officeValues: async () => ({ 'push.allowedSenders': ['trt5.jus.br'] }),
    });
    expect(result.delivered).toBe(1);
    expect(delivered[0].record.from).toBe('b@trt5.jus.br');
  });

  it('caixa desligada não conecta e mantém o ponto', async () => {
    let opened = false;
    const box = mailbox({ settings: { ...mailbox().settings, enabled: false } });
    const result = await pollMailbox(box, { ...deps(fakeSession([]), [court]), reader: { open: async () => { opened = true; return fakeSession([]); } } });
    expect(opened).toBe(false);
    expect(result.outcome.cursor).toEqual({ uidValidity: 'v1', lastUid: 10 });
  });
});
