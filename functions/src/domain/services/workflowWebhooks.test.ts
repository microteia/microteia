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
      return `ev-${published.length}`;
    },
    now: () => NOW,
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

  describe('a mesma entrega duas vezes', () => {
    const memory = () => {
      const marks = new Map<string, string | null>();
      const deliveries: NonNullable<WebhookReceiveDeps['deliveries']> = {
        claim: async (_t, _w, id) => (marks.has(id) ? { fresh: false, eventId: marks.get(id) ?? null } : (marks.set(id, null), { fresh: true })),
        settle: async (_t, _w, id, eventId) => { marks.set(id, eventId); },
        release: async (_t, _w, id) => { marks.delete(id); },
      };
      return { marks, deliveries };
    };
    const withDelivery: WebhookCredential = { ...TOKEN, deliveryHeader: 'x-github-delivery' };
    const delivered = (id: string | undefined, body = { orderId: 'P-10' }) => {
      const request = call({ body });
      return { ...request, headers: { ...request.headers, ...(id !== undefined ? { 'x-github-delivery': id } : {}) } };
    };

    it('o reenvio do mesmo id responde 200 com o evento da primeira, sem disparar de novo', async () => {
      const { deps, published } = setup(definition(), withDelivery);
      const { deliveries } = memory();
      deps.deliveries = deliveries;
      expect(await receiveWebhook(delivered('d-1'), deps)).toEqual({ status: 202, eventId: 'ev-1' });
      expect(await receiveWebhook(delivered('d-1'), deps)).toEqual({ status: 200, eventId: 'ev-1', duplicate: true });
      expect(published).toHaveLength(1);
    });

    it('chamar várias vezes continua valendo: cada entrega com id próprio dispara', async () => {
      const { deps, published } = setup(definition(), withDelivery);
      deps.deliveries = memory().deliveries;
      expect((await receiveWebhook(delivered('d-1'), deps)).status).toBe(202);
      expect((await receiveWebhook(delivered('d-2'), deps)).status).toBe(202);
      expect(published).toHaveLength(2);
    });

    it('sem o id declarado: 400; chamada recusada não deixa marca, e a corrigida é processada', async () => {
      const { deps, published } = setup(definition(), withDelivery);
      const { marks, deliveries } = memory();
      deps.deliveries = deliveries;
      expect(await receiveWebhook(delivered(undefined), deps)).toEqual({ status: 400, reason: 'delivery-id-missing' });
      expect((await receiveWebhook(delivered('d-3', { note: 'sem pedido' } as never), deps)).status).toBe(422);
      expect(marks.size).toBe(0);
      expect((await receiveWebhook(delivered('d-3'), deps)).status).toBe(202);
      expect(published).toHaveLength(1);
    });

    it('a publicação falhou: a marca sai, e o reenvio é processado de verdade', async () => {
      const { deps } = setup(definition(), withDelivery);
      const { marks, deliveries } = memory();
      deps.deliveries = deliveries;
      const publish = deps.publish;
      deps.publish = async () => { throw new Error('banco fora'); };
      await expect(receiveWebhook(delivered('d-4'), deps)).rejects.toThrow('banco fora');
      expect(marks.has('d-4')).toBe(false);
      deps.publish = publish;
      expect((await receiveWebhook(delivered('d-4'), deps)).status).toBe(202);
    });
  });

  describe('a data assinada', () => {
    const SECRET = 'chave-combinada';
    const seconds = Math.floor(NOW.getTime() / 1000);
    const raw = JSON.stringify({ orderId: 'P-12' });
    const sign = (content: string) => createHmac('sha256', SECRET).update(content).digest('hex');
    const request = (headers: Record<string, string>): WebhookRequest => ({ tenantId: 't1', workflowId: 'wf', headers, rawBody: raw, body: JSON.parse(raw) });

    it('o formato do Stripe é reconhecido sem configurar: a conta é sobre <data>.<corpo>', async () => {
      const { deps } = setup(definition(), { scheme: 'hmac', secret: SECRET, header: 'stripe-signature' });
      const ok = request({ 'stripe-signature': `t=${seconds},v1=${sign(`${seconds}.${raw}`)}` });
      expect((await receiveWebhook(ok, deps)).status).toBe(202);
    });

    it('a cópia capturada e reenviada depois da folga é recusada, mesmo com a assinatura certa', async () => {
      const { deps, published } = setup(definition(), { scheme: 'hmac', secret: SECRET, header: 'stripe-signature' });
      const old = seconds - 301;
      expect((await receiveWebhook(request({ 'stripe-signature': `t=${old},v1=${sign(`${old}.${raw}`)}` }), deps)).status).toBe(401);
      // E a data trocada por uma nova, sem refazer a assinatura, também: ela entra na conta.
      expect((await receiveWebhook(request({ 'stripe-signature': `t=${seconds},v1=${sign(`${old}.${raw}`)}` }), deps)).status).toBe(401);
      expect(published).toEqual([]);
    });

    it('a data num cabeçalho próprio, quando configurada; sem ela, a chamada é recusada', async () => {
      const credential: WebhookCredential = { scheme: 'hmac', secret: SECRET, header: 'x-signature', timestampHeader: 'x-signature-timestamp' };
      const { deps } = setup(definition(), credential);
      expect((await receiveWebhook(request({ 'x-signature': sign(`${seconds}.${raw}`), 'x-signature-timestamp': String(seconds) }), deps)).status).toBe(202);
      expect((await receiveWebhook(request({ 'x-signature': sign(raw) }), deps)).status).toBe(401);
    });
  });
});
