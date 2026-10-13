import { describe, expect, it, vi } from 'vitest';
import { makeDispatchNotificationUseCase } from './DispatchNotificationUseCase';
import type { DispatchNotificationDeps, DispatchNotificationRequest } from './DispatchNotificationUseCase';
import type { EmailMessage, NotificationRecipient } from '../repositories/INotificationDelivery';
import type { InboxNotificationDocument } from '../schema/notifications';
import { NOTIFICATION_MAX_RECIPIENTS } from '../schema/notifications';

const recipient = (userId: string, overrides: Partial<NotificationRecipient> = {}): NotificationRecipient => ({
  userId,
  email: `${userId}@example.com`,
  locale: 'en',
  channels: { inApp: true, email: true, push: true },
  ...overrides,
});

const request = (overrides: Partial<DispatchNotificationRequest> = {}): DispatchNotificationRequest => ({
  tenantId: 't1',
  workflowId: 'wf1',
  executionId: 'ex1',
  title: '@ext/title',
  message: 'Plain text from the office',
  params: { name: 'Ana' },
  link: 'view-record:abc',
  channels: { audit: false, inApp: false, email: false, push: false },
  recipientIds: [],
  recipientPermission: '',
  ...overrides,
});

const setup = (members: NotificationRecipient[], extra: Partial<DispatchNotificationDeps> = {}) => {
  const audit = vi.fn(async () => undefined);
  const delivered: InboxNotificationDocument[] = [];
  const sent: EmailMessage[] = [];
  const pushed = new Map<string, unknown>();
  const deps: DispatchNotificationDeps = {
    createAuditLog: { execute: audit },
    directory: {
      recipients: async (_tenantId, ids) => members.filter((member) => ids.includes(member.userId)),
      memberIdsGranting: async () => members.map((member) => member.userId),
    },
    inbox: { deliver: async (_tenantId, docs) => { delivered.push(...docs); } },
    emailConfig: {
      get: async () => ({ settings: {
        host: 'smtp', port: 587, secure: false, username: '', fromAddress: 'a@b.co', fromName: '', appUrl: 'https://app.test',
      }, password: '' }),
      save: async () => undefined,
      clear: async () => undefined,
    },
    emailTransport: { open: () => ({ send: async (message) => { sent.push(message); }, close: () => undefined }) },
    push: {
      send: async (payloads) => {
        payloads.forEach((payload, id) => pushed.set(id, payload));
        return { delivered: new Set(payloads.keys()), failed: new Set<string>() };
      },
    },
    catalog: { resolverFor: async (_tenantId, locale) => (value, params) => `${locale}:${value}:${params.name ?? ''}` },
    tenantName: async () => 'Acme',
    now: () => new Date('2026-10-13T12:00:00Z'),
    ...extra,
  };
  return { uc: makeDispatchNotificationUseCase(deps), audit, delivered, sent, pushed };
};

describe('DispatchNotificationUseCase', () => {
  it('sem canal pessoal, só grava na Auditoria — o comportamento da versão 1', async () => {
    const { uc, audit, delivered } = setup([recipient('u1')]);
    const result = await uc.execute(request({ channels: { audit: true, inApp: false, email: false, push: false } }));
    expect(audit).toHaveBeenCalledTimes(1);
    expect(result.delivered.audit).toBe(1);
    expect(result.recipients).toBe(0);
    expect(delivered).toEqual([]);
  });

  it('entrega no sino com a referência crua, para a tela resolver no idioma de quem lê', async () => {
    const { uc, delivered } = setup([recipient('u1'), recipient('u2')]);
    const result = await uc.execute(request({
      channels: { audit: false, inApp: true, email: false, push: false },
      recipientIds: ['u1', 'u2'],
    }));
    expect(result.delivered.inApp).toBe(2);
    expect(delivered.map((doc) => doc.recipientId)).toEqual(['u1', 'u2']);
    expect(delivered[0]).toMatchObject({ title: '@ext/title', params: { name: 'Ana' }, read: false, link: 'view-record:abc' });
    expect(delivered[0].expiresAt.getTime()).toBeGreaterThan(delivered[0].createdAt.getTime());
  });

  it('ignora quem não é membro e avisa no log', async () => {
    const { uc } = setup([recipient('u1')]);
    const result = await uc.execute(request({
      channels: { audit: false, inApp: true, email: false, push: false },
      recipientIds: ['u1', 'stranger'],
    }));
    expect(result.recipients).toBe(1);
    expect(result.issues.map((issue) => issue.message)).toContain('@core.automation/step.notify.recipients.not-members');
  });

  it('respeita a preferência da pessoa — recusar não conta como falha', async () => {
    const { uc, sent } = setup([recipient('u1', { channels: { inApp: true, email: false, push: true } })]);
    const result = await uc.execute(request({
      channels: { audit: false, inApp: false, email: true, push: false },
      recipientIds: ['u1'],
    }));
    expect(sent).toEqual([]);
    expect(result.delivered.email).toBe(0);
    expect(result.failed.email).toBe(0);
  });

  it('resolve o e-mail e o push no idioma de cada destinatário', async () => {
    const { uc, sent, pushed } = setup([recipient('u1', { locale: 'pt-BR' }), recipient('u2', { locale: 'en' })]);
    await uc.execute(request({
      channels: { audit: false, inApp: false, email: true, push: true },
      recipientIds: ['u1', 'u2'],
    }));
    expect(sent.find((message) => message.to === 'u1@example.com')?.subject).toBe('pt-BR:@ext/title:Ana');
    expect(sent.find((message) => message.to === 'u2@example.com')?.subject).toBe('en:@ext/title:Ana');
    expect(sent[0].html).toContain('https://app.test/view-record:abc');
    expect(pushed.get('u1')).toMatchObject({ title: 'pt-BR:@ext/title:Ana', link: 'view-record:abc', tenantId: 't1' });
  });

  it('e-mail sem credencial conta como falha, e os outros canais seguem', async () => {
    const { uc, delivered } = setup([recipient('u1')], {
      emailConfig: { get: async () => null, save: async () => undefined, clear: async () => undefined },
    });
    const result = await uc.execute(request({
      channels: { audit: false, inApp: true, email: true, push: false },
      recipientIds: ['u1'],
    }));
    expect(result.failed.email).toBe(1);
    expect(result.delivered.inApp).toBe(1);
    expect(delivered).toHaveLength(1);
    expect(result.issues.map((issue) => issue.message)).toContain('@core.automation/step.notify.email.not-configured');
  });

  it('um envio de e-mail recusado falha só ele', async () => {
    const { uc } = setup([recipient('u1'), recipient('u2')], {
      emailTransport: {
        open: () => ({
          send: async (message) => { if (message.to.startsWith('u2')) throw new Error('mailbox full'); },
          close: () => undefined,
        }),
      },
    });
    const result = await uc.execute(request({
      channels: { audit: false, inApp: false, email: true, push: false },
      recipientIds: ['u1', 'u2'],
    }));
    expect(result.delivered.email).toBe(1);
    expect(result.failed.email).toBe(1);
    expect(result.issues.find((issue) => issue.message.endsWith('email.failed'))?.params?.detail).toBe('mailbox full');
  });

  it('a permissão soma os membros que a têm, com teto', async () => {
    const many = Array.from({ length: NOTIFICATION_MAX_RECIPIENTS + 5 }, (_, index) => recipient(`u${index}`));
    const { uc } = setup(many);
    const result = await uc.execute(request({
      channels: { audit: false, inApp: true, email: false, push: false },
      recipientPermission: 'deadlines.update',
    }));
    expect(result.recipients).toBe(NOTIFICATION_MAX_RECIPIENTS);
    expect(result.issues.map((issue) => issue.message)).toContain('@core.automation/step.notify.recipients.truncated');
  });

  it('falha do sino não derruba os outros canais', async () => {
    const { uc, pushed } = setup([recipient('u1')], {
      inbox: { deliver: async () => { throw new Error('quota'); } },
    });
    const result = await uc.execute(request({
      channels: { audit: false, inApp: true, email: false, push: true },
      recipientIds: ['u1'],
    }));
    expect(result.failed.inApp).toBe(1);
    expect(result.delivered.push).toBe(1);
    expect(pushed.size).toBe(1);
  });
});
