import type { WorkflowDefinition } from '../entities/Workflow';
import { WORKFLOW_WEBHOOK_EVENT, missingWebhookParameters } from '../schema/workflowWebhook';

export interface WebhookReceiveDeps {
  /** O token confere com o hash guardado para ESTA automação, em tempo constante. */
  verifyToken(tenantId: string, workflowId: string, token: string): Promise<boolean>;
  findDefinition(tenantId: string, workflowId: string): Promise<WorkflowDefinition | null>;
  /** Publica o evento dirigido SÓ a esta automação e devolve o id dele. */
  publish(tenantId: string, workflowId: string, payload: Record<string, unknown>): Promise<string>;
}

export interface WebhookRequest {
  tenantId: string;
  workflowId: string;
  token: string;
  body: unknown;
}

export type WebhookOutcome =
  | { status: 202; eventId: string }
  | { status: 400 | 401 | 409 | 422; reason: string; missing?: string[] };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Recebe a chamada de um sistema de fora e a transforma num EVENTO — nunca numa execução em processo.
 *
 * A ordem é a da porta de qualquer credencial: o token PRIMEIRO, e com a mesma resposta (401) para
 * "não há webhook aqui" e "token errado". Dizer 404 para uma automação que não existe ensinaria a quem
 * varre a URL quais ids existem, sem credencial nenhuma.
 *
 * Depois do token, o que a chamada pode saber: a automação desligada ou que deixou de ser de webhook
 * (409), o corpo que não é um objeto (400) e os parâmetros obrigatórios que faltam (422, com os nomes).
 *
 * O corpo é DADO: ele vira o payload do evento como veio, e nenhum campo dele é avaliado como
 * expressão — é a fronteira de confiança de todo payload de evento.
 */
export const receiveWebhook = async (request: WebhookRequest, deps: WebhookReceiveDeps): Promise<WebhookOutcome> => {
  const { tenantId, workflowId, token } = request;
  if (!tenantId || !workflowId || !token || !(await deps.verifyToken(tenantId, workflowId, token))) {
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
