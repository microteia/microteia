import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { WorkflowDefinition } from '../entities/Workflow';
import {
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
  WORKFLOW_WEBHOOK_EVENT,
  missingWebhookParameters,
} from '../schema/workflowWebhook';
import type { WebhookProtection } from '../schema/workflowWebhook';

/**
 * A credencial gravada para UMA automação: o hash do token, ou o segredo da assinatura com o cabeçalho em
 * que ela chega. O segredo é guardado em claro — verificar HMAC exige a chave —, numa coleção que nenhum
 * cliente lê.
 */
export type WebhookCredential = (
  | { scheme: 'token'; tokenHash: string }
  | { scheme: 'hmac'; secret: string; header: string }
) & WebhookProtection;

/** A entrega já tinha chegado: o evento que ela publicou da primeira vez (`null` se ainda está publicando). */
export type DeliveryClaim = { fresh: true } | { fresh: false; eventId: string | null };

export interface WebhookReceiveDeps {
  credentialOf(tenantId: string, workflowId: string): Promise<WebhookCredential | null>;
  findDefinition(tenantId: string, workflowId: string): Promise<WorkflowDefinition | null>;
  /** Publica o evento dirigido SÓ a esta automação e devolve o id dele. */
  publish(tenantId: string, workflowId: string, payload: Record<string, unknown>): Promise<string>;
  /**
   * A marca da entrega, criada de uma vez só: quem chega primeiro a cria; a cópia recebe o evento da primeira.
   * Só é chamada quando o webhook declara `deliveryHeader`.
   */
  deliveries?: {
    claim(tenantId: string, workflowId: string, deliveryId: string): Promise<DeliveryClaim>;
    settle(tenantId: string, workflowId: string, deliveryId: string, eventId: string): Promise<void>;
    /** A publicação falhou: a marca sai, e o reenvio de quem chama é processado de verdade. */
    release(tenantId: string, workflowId: string, deliveryId: string): Promise<void>;
  };
  now(): Date;
}

export interface WebhookRequest {
  tenantId: string;
  workflowId: string;
  /** Os cabeçalhos da chamada, com o nome em minúsculas. */
  headers: Record<string, string | undefined>;
  /** O corpo como chegou, byte a byte — é ele que a assinatura cobre, nunca o JSON relido. */
  rawBody: string;
  body: unknown;
}

export type WebhookOutcome =
  | { status: 202; eventId: string }
  /** A MESMA entrega, de novo: sucesso para quem chama — ele para de reenviar —, sem disparar outra vez. */
  | { status: 200; eventId: string | null; duplicate: true }
  | { status: 400 | 401 | 409 | 422; reason: string; missing?: string[] };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const hashWebhookToken = (token: string): Buffer => createHash('sha256').update(token, 'utf8').digest();

/** O token vem num CABEÇALHO, nunca na URL: a URL vai para log de proxy, de navegador e do próprio Cloud Run. */
const tokenOf = (headers: WebhookRequest['headers']): string => {
  const bearer = /^Bearer\s+(.+)$/i.exec(headers.authorization ?? '');
  if (bearer) return bearer[1].trim();
  return (headers['x-microteia-token'] ?? '').trim();
};

/**
 * A assinatura recebida em bytes: aceita o prefixo `sha256=` (GitHub) e hex ou base64 (Shopify) — cada
 * sistema escreve a mesma conta de um jeito, e recusar um formato seria recusar o sistema.
 */
const signatureBytes = (value: string): Buffer | null => {
  const raw = value.trim().replace(/^sha256=/i, '');
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  const decoded = Buffer.from(raw, 'base64');
  return decoded.length === 32 ? decoded : null;
};

const sameBytes = (left: Buffer, right: Buffer): boolean =>
  left.length === right.length && timingSafeEqual(left, right);

/** A assinatura no formato do Stripe: `t=<segundos>,v1=<hex>` — a data viaja dentro do próprio cabeçalho. */
const stripeSignature = (value: string): { timestamp: string; signature: string } | null => {
  const parts = Object.fromEntries(value.split(',').map((part) => {
    const at = part.indexOf('=');
    return at > 0 ? [part.slice(0, at).trim(), part.slice(at + 1).trim()] : ['', ''];
  }));
  return typeof parts.t === 'string' && /^\d{1,12}$/.test(parts.t) && typeof parts.v1 === 'string'
    ? { timestamp: parts.t, signature: parts.v1 }
    : null;
};

const withinTolerance = (timestamp: string, now: Date): boolean => {
  const seconds = Number(timestamp);
  return Number.isFinite(seconds) && Math.abs(now.getTime() / 1000 - seconds) <= WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS;
};

/**
 * Em tempo constante nos dois esquemas: a comparação que vaza tempo ensina o segredo byte a byte.
 *
 * Na assinatura com DATA (a do Stripe, ou a de `timestampHeader`), a conta é sobre `<data>.<corpo>` e a data
 * precisa estar dentro da folga: a assinatura prova que o conteúdo é autêntico, a data prova que ele é novo.
 * Sem ela, uma chamada capturada valeria para sempre.
 */
export const authenticateWebhook = (credential: WebhookCredential, request: WebhookRequest, now: Date = new Date()): boolean => {
  if (credential.scheme === 'token') {
    const token = tokenOf(request.headers);
    return token !== '' && credential.tokenHash.length === 64
      && sameBytes(Buffer.from(credential.tokenHash, 'hex'), hashWebhookToken(token));
  }
  const header = request.headers[credential.header.toLowerCase()] ?? '';
  const stripe = stripeSignature(header);
  const timestamp = stripe?.timestamp
    ?? (credential.timestampHeader ? (request.headers[credential.timestampHeader.toLowerCase()] ?? '').trim() : null);
  if (timestamp !== null && !withinTolerance(timestamp, now)) return false;
  const received = signatureBytes(stripe?.signature ?? header);
  if (!received) return false;
  const signed = timestamp !== null ? `${timestamp}.${request.rawBody}` : request.rawBody;
  return sameBytes(createHmac('sha256', credential.secret).update(signed, 'utf8').digest(), received);
};

/**
 * Recebe a chamada de um sistema de fora e a transforma num EVENTO — nunca numa execução em processo.
 *
 * A ordem é a da porta de qualquer credencial: a credencial PRIMEIRO, e com a mesma resposta (401) para
 * "não há webhook aqui" e "credencial errada". Dizer 404 para uma automação que não existe ensinaria a
 * quem varre a URL quais ids existem, sem credencial nenhuma.
 *
 * Depois dela, o que a chamada pode saber: a automação desligada ou que deixou de ser de webhook (409), o
 * corpo que não é um objeto (400), os parâmetros obrigatórios que faltam (422, com os nomes) e, com a
 * proteção de entrega, o id que não veio (400) ou a entrega que já tinha chegado (200, sem disparar de novo).
 *
 * O corpo é DADO: ele vira o payload do evento como veio, e nenhum campo dele é avaliado como
 * expressão — é a fronteira de confiança de todo payload de evento.
 */
export const receiveWebhook = async (request: WebhookRequest, deps: WebhookReceiveDeps): Promise<WebhookOutcome> => {
  const { tenantId, workflowId } = request;
  const credential = tenantId && workflowId ? await deps.credentialOf(tenantId, workflowId) : null;
  if (!credential || !authenticateWebhook(credential, request, deps.now())) {
    return { status: 401, reason: 'unauthorized' };
  }

  const definition = await deps.findDefinition(tenantId, workflowId);
  if (!definition || !definition.enabled || definition.eventName !== WORKFLOW_WEBHOOK_EVENT) {
    return { status: 409, reason: 'workflow-unavailable' };
  }

  if (!isPlainObject(request.body)) return { status: 400, reason: 'body-not-object' };

  const missing = missingWebhookParameters(definition.parameters, request.body);
  if (missing.length > 0) return { status: 422, reason: 'missing-parameters', missing };

  // A entrega repetida é descartada DEPOIS de tudo o que a recusaria: uma cópia de chamada recusada não
  // deixa marca, e o reenvio corrigido é processado.
  const deliveryId = credential.deliveryHeader
    ? (request.headers[credential.deliveryHeader.toLowerCase()] ?? '').trim()
    : null;
  if (deliveryId === '') return { status: 400, reason: 'delivery-id-missing' };
  if (deliveryId !== null && deps.deliveries) {
    const claim = await deps.deliveries.claim(tenantId, workflowId, deliveryId);
    if (!claim.fresh) return { status: 200, eventId: claim.eventId, duplicate: true };
    let eventId: string;
    try {
      eventId = await deps.publish(tenantId, workflowId, request.body);
    } catch (error) {
      await deps.deliveries.release(tenantId, workflowId, deliveryId);
      throw error;
    }
    await deps.deliveries.settle(tenantId, workflowId, deliveryId, eventId);
    return { status: 202, eventId };
  }

  return { status: 202, eventId: await deps.publish(tenantId, workflowId, request.body) };
};
