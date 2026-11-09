import type { PublishedActor } from '../engine/workflowActor';
import type { HttpMethod, HttpResponseType } from '../schema/httpRequestSpec';

/**
 * Um pedido HTTP na fila (`tenants/{t}/http_dispatches/{id}`). Guarda o pedido JÁ MONTADO — os valores
 * dinâmicos resolvidos no momento em que a automação rodou —, mas nunca o segredo: a credencial é
 * guardada pela CHAVE e aplicada a cada tentativa, e trocar ou apagar o segredo vale para a próxima.
 */
export interface HttpDispatchRequest {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

/** O fluxo que recebe o resultado, com os parâmetros que a automação de origem fixou para ele. */
export interface HttpDispatchCallback {
  workflowId: string;
  params: Record<string, unknown>;
  /** A profundidade do callback na cadeia de chamadas — o mesmo teto do "Chamar Workflow". */
  callDepth: number;
}

export interface HttpDispatchInput {
  request: HttpDispatchRequest;
  connection?: string;
  responseType?: HttpResponseType;
  timeoutSeconds: number;
  /** Tentativas no total: a primeira mais as `retries` da especificação. */
  maxAttempts: number;
  callback?: HttpDispatchCallback;
  actor?: PublishedActor;
  origin: { workflowId: string; executionId: string };
}

/**
 * - `queued`: esperando quem o entregue (a gravação é o gatilho);
 * - `sending`: reservado por uma entrega, em voo;
 * - `waiting`: falhou de um jeito passageiro e espera a próxima tentativa;
 * - `done` / `failed`: terminou — não volta para a fila.
 */
export type HttpDispatchStatus = 'queued' | 'sending' | 'waiting' | 'done' | 'failed';

export interface HttpDispatchRecord extends HttpDispatchInput {
  id: string;
  status: HttpDispatchStatus;
  /** Quantas tentativas já COMEÇARAM, contando a que a reserva acabou de abrir. */
  attempts: number;
}

/** O resumo do que houve, gravado no pedido ao terminar. O corpo da resposta vai só para o callback. */
export interface HttpDispatchSummary {
  ok: boolean;
  status: number;
  durationMs: number;
  timedOut: boolean;
  error: string | null;
  errorParams?: Record<string, string>;
}

/** O evento do callback, gravado na MESMA transação que encerra o pedido. */
export interface HttpDispatchCallbackEvent {
  payload: Record<string, unknown>;
  actor?: PublishedActor;
}

/** O que o passo precisa: pôr na fila. */
export interface IHttpDispatchQueue {
  enqueue(tenantId: string, input: HttpDispatchInput, now: Date): Promise<string>;
}

export interface IHttpDispatchRepository extends IHttpDispatchQueue {
  /**
   * Reserva o pedido `queued` para UMA entrega (`sending`, tentativa + 1, reserva até `leaseUntil`).
   * `null` quando outro já o reservou ou ele já terminou — a entrega duplicada do gatilho para aqui.
   */
  claim(tenantId: string, id: string, now: Date, leaseUntil: Date): Promise<HttpDispatchRecord | null>;
  /** Devolve à espera, para nova tentativa em `retryAt`. Só se a reserva ainda é desta tentativa. */
  reschedule(tenantId: string, id: string, attempt: number, retryAt: Date, last: HttpDispatchSummary, now: Date): Promise<boolean>;
  /**
   * Encerra o pedido e, se houver, publica o evento do callback NA MESMA TRANSAÇÃO: encerrar sem avisar,
   * ou avisar duas vezes, não acontece. `false` quando a reserva já não é desta tentativa.
   */
  finish(
    tenantId: string,
    id: string,
    attempt: number,
    final: { status: 'done' | 'failed'; summary: HttpDispatchSummary },
    now: Date,
    callback?: HttpDispatchCallbackEvent,
  ): Promise<boolean>;
  /**
   * Devolve à fila (`queued`) o que venceu a hora de ser olhado de novo: a espera que acabou, a reserva
   * de uma entrega que morreu no meio, o pedido que ninguém pegou. Devolve quantos voltaram.
   */
  requeueDue(now: Date, limit: number): Promise<number>;
}
