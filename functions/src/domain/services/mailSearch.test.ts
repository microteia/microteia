import { describe, expect, it } from 'vitest';
import type { MailEnvelope, MailReadSession } from '../repositories/IMailReader';
import { MailReadError } from '../repositories/IMailReader';
import type { StoredMailbox } from '../repositories/IMailboxRepository';
import { EMPTY_MAILBOX_SETTINGS, MAIL_SEARCH_BODY_MAX_CHARS, MAIL_SEARCH_MAX_RESULTS_WITH_BODY } from '../schema/mailbox';
import { mailboxSearchableBy, searchMailbox } from './mailSearch';
import type { MailSearchDeps } from './mailSearch';

const NOW = new Date('2026-11-14T12:00:00.000Z');

const box = (extra: Partial<StoredMailbox> = {}): StoredMailbox => ({
  tenantId: 't',
  id: 'box',
  ownerId: null,
  settings: { ...EMPTY_MAILBOX_SETTINGS, name: 'Intimações', subscriptions: ['wf'] },
  hasPassword: true,
  cursor: null,
  nextPollAt: null,
  health: { lastPolledAt: null, lastDeliveredAt: null, lastDelivered: 0, failure: null },
  inboundToken: null,
  forwardingConfirmation: null,
  ...extra,
});

const envelope = (uid: number, from: string, subject: string): MailEnvelope => ({
  uid, messageId: `<m${uid}@x>`, from, fromName: 'Fulano', subject, date: NOW, attachmentCount: 0,
});

const session = (envelopes: MailEnvelope[], seen: { since?: Date; limit?: number; fetched: number[] } = { fetched: [] }): MailReadSession => ({
  status: { uidValidity: 'v1', uidNext: 100 },
  listAfter: async () => [],
  listSince: async () => [],
  listRecent: async (since, _prefilter, limit) => {
    seen.since = since;
    seen.limit = limit;
    return [...envelopes].reverse().slice(0, limit);
  },
  fetch: async (uid) => {
    seen.fetched.push(uid);
    const one = envelopes.find((item) => item.uid === uid)!;
    return {
      mail: {
        messageId: one.messageId, from: one.from, fromName: 'Fulano', to: [], cc: [], replyTo: '', subject: one.subject,
        date: NOW, text: 'x'.repeat(MAIL_SEARCH_BODY_MAX_CHARS + 50), html: '<p>x</p>',
        attachments: [{ name: 'a.pdf', contentType: 'application/pdf', size: 3 }],
      },
      raw: Buffer.from('raw'),
    };
  },
  close: async () => undefined,
});

const deps = (mailbox: StoredMailbox | null, readSession: MailReadSession): MailSearchDeps => ({
  getMailbox: async () => mailbox,
  password: async () => 'secret',
  reader: { open: async () => readSession },
  now: () => NOW,
});

describe('mailboxSearchableBy', () => {
  it('a caixa do escritório, sempre; a de um membro, só se ele a ligou a esta automação', () => {
    expect(mailboxSearchableBy(box(), 'qualquer')).toBe(true);
    expect(mailboxSearchableBy(box({ ownerId: 'u1' }), 'wf')).toBe(true);
    expect(mailboxSearchableBy(box({ ownerId: 'u1' }), 'outra')).toBe(false);
  });
});

describe('searchMailbox', () => {
  it('devolve as mais recentes primeiro, conferindo o remetente pela regra do filtro', async () => {
    const result = await searchMailbox(
      { tenantId: 't', workflowId: 'wf', mailboxId: 'box', from: '*.jus.br' },
      deps(box(), session([envelope(1, 'a@tjba.jus.br', 'A'), envelope(2, 'promo@loja.com', 'B'), envelope(3, 'b@trt5.jus.br', 'C')])),
    );
    expect(result.ok && result.messages.map((message) => message.subject)).toEqual(['C', 'A']);
  });

  it('a caixa de membro que não ligou esta automação responde como a que não existe', async () => {
    const vazia = await searchMailbox({ tenantId: 't', workflowId: 'outra', mailboxId: 'box' }, deps(box({ ownerId: 'u1' }), session([])));
    const inexistente = await searchMailbox({ tenantId: 't', workflowId: 'wf', mailboxId: 'nada' }, deps(null, session([])));
    expect(vazia).toEqual({ ok: false, error: '@core.automation/step.mail-search.unavailable', errorParams: { mailbox: 'box' } });
    expect(inexistente.ok).toBe(false);
    expect(!inexistente.ok && inexistente.error).toBe('@core.automation/step.mail-search.unavailable');
  });

  it('a caixa de encaminhamento não se consulta: não há caixa para ler', async () => {
    const result = await searchMailbox(
      { tenantId: 't', workflowId: 'wf', mailboxId: 'box' },
      deps(box({ settings: { ...box().settings, source: 'forward' } }), session([])),
    );
    expect(!result.ok && result.error).toBe('@core.automation/step.mail-search.not-imap');
  });

  it('com o corpo: menos mensagens, texto cortado, sem HTML', async () => {
    const seen = { fetched: [] as number[] } as { since?: Date; limit?: number; fetched: number[] };
    const many = Array.from({ length: 30 }, (_, i) => envelope(i + 1, 'a@tjba.jus.br', `S${i + 1}`));
    const result = await searchMailbox({ tenantId: 't', workflowId: 'wf', mailboxId: 'box', includeBody: true, limit: 50 }, deps(box(), session(many, seen)));
    expect(result.ok && result.messages).toHaveLength(MAIL_SEARCH_MAX_RESULTS_WITH_BODY);
    const first = result.ok ? result.messages[0] : null;
    expect(first?.text).toHaveLength(MAIL_SEARCH_BODY_MAX_CHARS);
    expect(first).not.toHaveProperty('html');
    expect(first?.attachments).toEqual([{ name: 'a.pdf', contentType: 'application/pdf', size: 3 }]);
  });

  it('os dias ficam entre 1 e 30', async () => {
    const seen = { fetched: [] as number[] } as { since?: Date; limit?: number; fetched: number[] };
    await searchMailbox({ tenantId: 't', workflowId: 'wf', mailboxId: 'box', days: 400 }, deps(box(), session([], seen)));
    expect(seen.since?.toISOString()).toBe(new Date(NOW.getTime() - 30 * 86_400_000).toISOString());
  });

  it('a falha da caixa vem classificada, como na leitura', async () => {
    const result = await searchMailbox({ tenantId: 't', workflowId: 'wf', mailboxId: 'box' }, {
      ...deps(box(), session([])),
      reader: { open: async () => { throw new MailReadError('auth', 'denied'); } },
    });
    expect(result).toEqual({ ok: false, error: '@core.automation/mailbox.failure.auth', errorParams: { name: 'Intimações', detail: 'denied' } });
  });
});
