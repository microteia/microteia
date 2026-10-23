import { describe, expect, it, vi } from 'vitest';
import { makeDispatchNotificationUseCase } from './DispatchNotificationUseCase';
import type { DispatchNotificationDeps, DispatchNotificationRequest } from './DispatchNotificationUseCase';
import type { EmailMessage, NotificationRecipient } from '../repositories/INotificationDelivery';
import type { InboxNotificationDocument } from '../schema/notifications';
import { NOTIFICATION_MAX_RECIPIENTS } from '../schema/notifications';
import type { PortalGuestsOfRecord } from './ResolvePortalGuestsUseCase';

const recipient = (userId: string, overrides: Partial<NotificationRecipient> = {}): NotificationRecipient => ({
  userId,
  email: `${userId}@example.com`,
  locale: 'en',
  channels: { inApp: true, email: true, push: true },
  mutes: {},
  ...overrides,
});

const request = (overrides: Partial<DispatchNotificationRequest> = {}): DispatchNotificationRequest => ({
  tenantId: 't1',
  source: 'workflow',
  workflowId: 'wf1',
  executionId: 'ex1',
  title: '@ext/title',
  message: 'Plain text from the office',
  params: { name: 'Ana' },
  link: 'view-record:abc',
  channels: { audit: false, inApp: false, email: false, push: false },
  recipientIds: [],
  recipientPermissions: [],
  ...overrides,
});

const setup = (
  members: NotificationRecipient[],
  extra: Partial<DispatchNotificationDeps> = {},
  portal: PortalGuestsOfRecord = { inPortal: false, guests: [] },
) => {
  const audit = vi.fn(async () => undefined);
  const delivered: InboxNotificationDocument[] = [];
  const sent: EmailMessage[] = [];
  const pushed = new Map<string, unknown>();
  const claimed = new Set<string>();
  const look: Awaited<ReturnType<DispatchNotificationDeps['appearance']['get']>> = {
    layout: { showLogo: true, accentColor: '', signature: '', footer: '' },
    templates: {},
    logoURL: null,
  };
  const deps: DispatchNotificationDeps = {
    createAuditLog: { execute: audit },
    directory: {
      recipients: async (_tenantId, ids) => members.filter((member) => ids.includes(member.userId)),
      memberIdsGranting: async () => members.map((member) => member.userId),
      guests: async (_tenantId, contacts) => contacts.map((contact) => recipient(contact.userId, {
        email: contact.email,
        locale: contact.locale ?? 'en',
        channels: { inApp: true, email: true, push: false },
      })),
    },
    portalGuests: { execute: async () => portal },
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
    appearance: { get: async () => look },
    dispatches: { claim: async (_tenantId, id) => { if (claimed.has(id)) return false; claimed.add(id); return true; } },
    tenantName: async () => 'Acme',
    now: () => new Date('2026-10-13T12:00:00Z'),
    ...extra,
  };
  return { uc: makeDispatchNotificationUseCase(deps), audit, delivered, sent, pushed, look };
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
    expect(sent[0].html).toContain('https://app.test/microteia/view-record%3Aabc?tenant=t1');
    expect(pushed.get('u1')).toMatchObject({ title: 'pt-BR:@ext/title:Ana', link: '/microteia/view-record%3Aabc?tenant=t1', tenantId: 't1' });
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
      recipientPermissions: ['deadlines.update'],
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

  it('o alvo vai para o aviso e para a Auditoria, e o link de fora abre o registro no escritório certo', async () => {
    const { uc, delivered, pushed, sent, audit } = setup([recipient('u1')]);
    await uc.execute(request({
      link: '',
      target: { collection: 'invoices', recordId: 'nf1' },
      category: 'core.automation/portal-activity',
      channels: { audit: true, inApp: true, email: true, push: true },
      recipientIds: ['u1'],
    }));
    expect(delivered[0]).toMatchObject({
      target: { collection: 'invoices', recordId: 'nf1' }, category: 'core.automation/portal-activity', source: 'workflow',
    });
    expect(pushed.get('u1')).toMatchObject({ link: '/microteia/record%3Ainvoices%3Anf1?tenant=t1' });
    expect(sent[0].text).toContain('https://app.test/microteia/record%3Ainvoices%3Anf1?tenant=t1');
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ linkCollection: 'invoices', linkRecordId: 'nf1' }));
  });

  it('o canal silenciado pela pessoa para AQUELE tipo não chega — os outros tipos sim', async () => {
    const quiet = recipient('u1', { mutes: { 'core.automation/portal-activity': ['email'] } });
    const { uc, sent, delivered } = setup([quiet]);
    const all = { audit: false, inApp: true, email: true, push: false };
    await uc.execute(request({ channels: all, recipientIds: ['u1'], category: 'core.automation/portal-activity' }));
    expect(sent).toHaveLength(0);
    expect(delivered).toHaveLength(1);
    await uc.execute(request({ channels: all, recipientIds: ['u1'], category: 'ext/other' }));
    expect(sent).toHaveLength(1);
  });

  it('várias permissões: recebe só quem tem TODAS', async () => {
    const members = [recipient('u1'), recipient('u2'), recipient('u3')];
    const holders: Record<string, string[]> = { 'invoices.update': ['u1', 'u2'], 'portal.activity': ['u2', 'u3'] };
    const { uc, delivered } = setup(members, {
      directory: {
        recipients: async (_tenantId, ids) => members.filter((member) => ids.includes(member.userId)),
        memberIdsGranting: async (_tenantId, permission) => holders[permission] ?? [],
        guests: async () => [],
      },
    });
    await uc.execute(request({
      channels: { audit: false, inApp: true, email: false, push: false },
      recipientPermissions: ['invoices.update', 'portal.activity'],
    }));
    expect(delivered.map((doc) => doc.recipientId)).toEqual(['u2']);
  });

  it('a mesma chave não avisa duas vezes', async () => {
    const { uc, delivered, sent } = setup([recipient('u1')]);
    const once = request({ channels: { audit: false, inApp: true, email: true, push: false }, recipientIds: ['u1'], dedupKey: 'nf1:created' });
    await uc.execute(once);
    const again = await uc.execute(once);
    expect(delivered).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(again.issues.map((issue) => issue.message)).toEqual(['@core.automation/step.notify.duplicate']);
  });

  it('o modelo do tipo vale por canal, e o valor de registro entra escapado no Markdown do e-mail', async () => {
    const { uc, look, sent, pushed, delivered } = setup([recipient('u1', { locale: 'pt-BR' })]);
    look.templates = {
      'ext/order': {
        email: { subject: 'Pedido de {name}', body: '**Olá**, {name} mandou: {message}' },
        push: { title: 'Pedido', body: 'de {name}' },
        inApp: { title: '{name} pediu', message: 'no escritório {tenant}' },
      },
    };
    look.layout = { showLogo: true, accentColor: '#ff0000', signature: '*Equipe*', footer: 'Rodapé de {tenant}' };
    await uc.execute(request({
      category: 'ext/order',
      params: { name: '[clique](https://evil.test)' },
      channels: { audit: false, inApp: true, email: true, push: true },
      recipientIds: ['u1'],
    }));
    expect(sent[0].subject).toBe('Pedido de [clique](https://evil.test)');
    expect(sent[0].html).toContain('<strong>Olá</strong>');
    expect(sent[0].html).not.toContain('href="https://evil.test"');
    expect(sent[0].html).toContain('#ff0000');
    expect(sent[0].html).toContain('<em>Equipe</em>');
    expect(sent[0].html).toContain('Rodapé de Acme');
    expect(pushed.get('u1')).toMatchObject({ title: 'Pedido', body: 'de [clique](https://evil.test)' });
    expect(delivered[0]).toMatchObject({ title: '[clique](https://evil.test) pediu', message: 'no escritório Acme', params: {} });
  });

  it('sem modelo do tipo, vale o Geral; sem nenhum, o texto de sempre', async () => {
    const { uc, look, sent, delivered } = setup([recipient('u1')]);
    look.templates = { '': { email: { subject: 'Aviso: {title}', body: '{message}' } } };
    await uc.execute(request({ category: 'ext/none', channels: { audit: false, inApp: true, email: true, push: false }, recipientIds: ['u1'] }));
    expect(sent[0].subject).toBe('Aviso: en:@ext/title:Ana');
    expect(delivered[0]).toMatchObject({ title: '@ext/title', params: { name: 'Ana' } });
  });

  it('a aparência que não pode ser lida não impede o aviso', async () => {
    const { uc, sent } = setup([recipient('u1')], { appearance: { get: async () => { throw new Error('down'); } } });
    const result = await uc.execute(request({ channels: { audit: false, inApp: false, email: true, push: false }, recipientIds: ['u1'] }));
    expect(result.delivered.email).toBe(1);
    expect(sent[0].subject).toBe('en:@ext/title:Ana');
  });

  describe('aos convidados do portal', () => {
    const target = { collection: 'conversations', recordId: 'c1' };
    const seen: PortalGuestsOfRecord = {
      inPortal: true,
      guests: [{ userId: 'g1', email: 'cliente@example.com', locale: 'pt-BR' }],
    };
    const portalRequest = (overrides: Partial<DispatchNotificationRequest> = {}) => request({
      audience: 'portal',
      target,
      channels: { audit: false, inApp: true, email: true, push: false },
      ...overrides,
    });

    it('avisa só quem vê o registro, com o link dele NO PORTAL e o texto já no idioma do convite', async () => {
      const { uc, delivered, sent } = setup([recipient('u1')], {}, seen);
      const result = await uc.execute(portalRequest({ recipientIds: ['u1'], recipientPermissions: ['x.update'] }));
      expect(result.recipients).toBe(1);
      expect(delivered).toHaveLength(1);
      expect(delivered[0]).toMatchObject({
        audience: 'portal',
        recipientId: 'g1',
        title: 'pt-BR:@ext/title:Ana',
        params: {},
        link: '',
        target,
      });
      expect(sent.map((message) => message.to)).toEqual(['cliente@example.com']);
      expect(sent[0].html).toContain('https://app.test/portal/t1/conversations?record=c1');
      expect(sent[0].html).not.toContain('/microteia/');
    });

    it('o registro fora do portal não leva aviso a ninguém', async () => {
      const { uc, delivered, sent } = setup([], {}, { inPortal: false, guests: [] });
      const result = await uc.execute(portalRequest());
      expect(result.recipients).toBe(0);
      expect(delivered).toEqual([]);
      expect(sent).toEqual([]);
      expect(result.issues.map((issue) => issue.message)).toContain('@core.automation/step.notify.portal.not-in-portal');
    });

    it('sem registro, não há de quem perguntar quem vê', async () => {
      const { uc } = setup([], {}, seen);
      const result = await uc.execute(portalRequest({ target: null }));
      expect(result.recipients).toBe(0);
      expect(result.issues.map((issue) => issue.message)).toContain('@core.automation/step.notify.portal.no-record');
    });

    it('registra na Auditoria o que saiu do escritório, mesmo sem toAudit', async () => {
      const { uc, audit } = setup([], {}, seen);
      await uc.execute(portalRequest());
      expect(audit).toHaveBeenCalledTimes(1);
      expect(audit).toHaveBeenCalledWith(expect.objectContaining({
        title: '@core.automation/notifications.portal.audit',
        titleParams: { count: '1' },
        text: '@ext/title',
        linkCollection: 'conversations',
        linkRecordId: 'c1',
      }));
    });

    it('push não existe para o convidado, e o log diz por quê', async () => {
      const { uc, pushed } = setup([], {}, seen);
      const result = await uc.execute(portalRequest({ channels: { audit: false, inApp: false, email: false, push: true } }));
      expect(pushed.size).toBe(0);
      expect(result.issues.map((issue) => issue.message)).toContain('@core.automation/step.notify.portal.push-unsupported');
    });

    it('o aviso ao membro continua com a referência crua e marcado como do escritório', async () => {
      const { uc, delivered } = setup([recipient('u1')], {}, seen);
      await uc.execute(request({ channels: { audit: false, inApp: true, email: false, push: false }, recipientIds: ['u1'] }));
      expect(delivered[0]).toMatchObject({ audience: 'members', recipientId: 'u1', title: '@ext/title' });
    });
  });
});
