import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { WorkflowDefinition } from '../entities/Workflow';
import { WORKFLOW_WEBHOOK_EVENT, missingWebhookParameters } from '../schema/workflowWebhook';

/**
 * A credencial gravada para UMA automação: o hash do token, ou o segredo da assinatura com o cabeçalho em
 * que ela chega. O segredo é guardado em claro — verificar HMAC exige a chave —, numa coleção que nenhum
 * cliente lê.
 */
export type WebhookCredential =
  | { scheme: 'token'; tokenHash: string }
  | { scheme: 'hmac'; secret: string; header: string };

export interface WebhookReceiveDeps {
  credentialOf(tenantId: string, workflowId: string): Promise<WebhookCredential | null>;
  findDefinition(tenantId: string, workflowId: string): Promise<WorkflowDefinition | null>;
  /** Publica o evento dirigido SÓ a esta automação e devolve o id dele. */
  publish(tenantId: string, workflowId: string, payload: Record<string, unknown>): Promise<string>;
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

/** Em tempo constante nos dois esquemas: a comparação que vaza tempo ensina o segredo byte a byte. */
export const authenticateWebhook = (credential: WebhookCredential, request: WebhookRequest): boolean => {
  if (credential.scheme === 'token') {
    const token = tokenOf(request.headers);
    return token !== '' && credential.tokenHash.length === 64
      && sameBytes(Buffer.from(credential.tokenHash, 'hex'), hashWebhookToken(token));
  }
  const received = signatureBytes(request.headers[credential.header.toLowerCase()] ?? '');
  if (!received) return false;
  return sameBytes(createHmac('sha256', credential.secret).update(request.rawBody, 'utf8').digest(), received);
};

/**
 * Recebe a chamada de um sistema de fora e a transforma num EVENTO — nunca numa execução em processo.
 *
 * A ordem é a da porta de qualquer credencial: a credencial PRIMEIRO, e com a mesma resposta (401) para
 * "não há webhook aqui" e "credencial errada". Dizer 404 para uma automação que não existe ensinaria a
 * quem varre a URL quais ids existem, sem credencial nenhuma.
 *
 * Depois dela, o que a chamada pode saber: a automação desligada ou que deixou de ser de webhook (409), o
 * corpo que não é um objeto (400) e os parâmetros obrigatórios que faltam (422, com os nomes).
 *
 * O corpo é DADO: ele vira o payload do evento como veio, e nenhum campo dele é avaliado como
 * expressão — é a fronteira de confiança de todo payload de evento.
 */
export const receiveWebhook = async (request: WebhookRequest, deps: WebhookReceiveDeps): Promise<WebhookOutcome> => {
  const { tenantId, workflowId } = request;
  const credential = tenantId && workflowId ? await deps.credentialOf(tenantId, workflowId) : null;
  if (!credential || !authenticateWebhook(credential, request)) {
    return { status: 401, reason: 'unauthorized' };
  }

  const definition = await deps.findDefinition(tenantId, workflowId);
  if (!definition || !definition.enabled || definition.eventName !== WORKFLOW_WEBHOOK_EVENT) {
    return { status: 409, reason: 'workflow-unavailable' };
  }

  if (!isPlainObject(request.body)) return { status: 400, reason: 'body-not-object' };

  const missing = missingWebhookParameters(definition.parameters, request.body);
  if (missing.length > 0) return { status: 422, reason: 'missing-parameters', missing };

  return { status: 202, eventId: await deps.publish(tenantId, workflowId, request.body) };
};
