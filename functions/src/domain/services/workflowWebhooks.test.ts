import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { hashWebhookToken, receiveWebhook } from './workflowWebhooks';
import type { WebhookCredential, WebhookReceiveDeps, WebhookRequest } from './workflowWebhooks';
import type { WorkflowDefinition } from '../entities/Workflow';

const NOW = new Date('2026-11-12T12:00:00Z');

const definition = (overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition => ({
  id: 'wf',
  tenantId: 't1',
  name: 'Pedido recebido',
  eventName: 'webhook.received',
  enabled: true,
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [],
  parameters: [
    { key: 'orderId', label: 'Pedido', type: 'String', required: true },
    { key: 'note', label: 'Observação', type: 'String' },
  ],
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const TOKEN: WebhookCredential = { scheme: 'token', tokenHash: hashWebhookToken('segredo').toString('hex') };

const setup = (stored: WorkflowDefinition | null = definition(), credential: WebhookCredential = TOKEN) => {
  const published: { tenantId: string; workflowId: string; payload: Record<string, unknown> }[] = [];
  const deps: WebhookReceiveDeps = {
    credentialOf: async (_tenantId, workflowId) => (workflowId === 'wf' ? credential : null),
    findDefinition: async () => stored,
    publish: async (tenantId, workflowId, payload) => {
      published.push({ tenantId, workflowId, payload });
      return 'ev-1';
    },
  };
  return { deps, published };
};

const call = (overrides: Partial<WebhookRequest> & { token?: string } = {}): WebhookRequest => {
  const { token = 'segredo', ...rest } = overrides;
  const body = rest.body ?? { orderId: 'P-10', note: 'urgente' };
  return {
    tenantId: 't1',
    workflowId: 'wf',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    rawBody: JSON.stringify(body),
    ...rest,
    body,
  };
};

describe('receiveWebhook', () => {
  it('publica o corpo como evento dirigido só à automação, e responde 202', async () => {
    const { deps, published } = setup();
    expect(await receiveWebhook(call(), deps)).toEqual({ status: 202, eventId: 'ev-1' });
    expect(published).toEqual([{ tenantId: 't1', workflowId: 'wf', payload: { orderId: 'P-10', note: 'urgente' } }]);
  });

  it('token errado, ausente ou de outra automação: 401 — sem dizer se a automação existe', async () => {
    const { deps, published } = setup();
    expect((await receiveWebhook(call({ token: 'outro' }), deps)).status).toBe(401);
    expect((await receiveWebhook(call({ token: '' }), deps)).status).toBe(401);
    expect((await receiveWebhook(call({ workflowId: 'nao-existe' }), deps)).status).toBe(401);
    expect(published).toEqual([]);
  });

  it('automação desligada, apagada ou que deixou de ser de webhook: 409', async () => {
    expect((await receiveWebhook(call(), setup(definition({ enabled: false })).deps)).status).toBe(409);
    expect((await receiveWebhook(call(), setup(null).deps)).status).toBe(409);
    expect((await receiveWebhook(call(), setup(definition({ eventName: 'workflow.called' })).deps)).status).toBe(409);
  });

  it('corpo que não é objeto: 400; parâmetro obrigatório faltando: 422 com o nome', async () => {
    const { deps, published } = setup();
    expect((await receiveWebhook(call({ body: [1, 2] }), deps)).status).toBe(400);
    expect((await receiveWebhook(call({ body: 'texto' }), deps)).status).toBe(400);
    expect(await receiveWebhook(call({ body: { note: 'x' } }), deps))
      .toEqual({ status: 422, reason: 'missing-parameters', missing: ['orderId'] });
    expect(published).toEqual([]);
  });

  describe('assinatura HMAC', () => {
    const HMAC: WebhookCredential = { scheme: 'hmac', secret: 'chave-combinada', header: 'x-hub-signature-256' };
    const signed = (raw: string, format: (digest: Buffer) => string): WebhookRequest => ({
      tenantId: 't1',
      workflowId: 'wf',
      headers: { 'x-hub-signature-256': format(createHmac('sha256', 'chave-combinada').update(raw).digest()) },
      rawBody: raw,
      body: JSON.parse(raw),
    });
    const raw = JSON.stringify({ orderId: 'P-11' });

    it('aceita a assinatura em hex com prefixo (GitHub) e em base64 (Shopify)', async () => {
      const { deps } = setup(definition(), HMAC);
      expect((await receiveWebhook(signed(raw, (d) => `sha256=${d.toString('hex')}`), deps)).status).toBe(202);
      expect((await receiveWebhook(signed(raw, (d) => d.toString('base64')), deps)).status).toBe(202);
    });

    it('corpo alterado depois de assinado, ou o token no lugar da assinatura: 401', async () => {
      const { deps, published } = setup(definition(), HMAC);
      const tampered = { ...signed(raw, (d) => d.toString('hex')), rawBody: JSON.stringify({ orderId: 'P-99' }) };
      expect((await receiveWebhook(tampered, deps)).status).toBe(401);
      expect((await receiveWebhook(call(), deps)).status).toBe(401);
      expect(published).toEqual([]);
    });
  });
});
