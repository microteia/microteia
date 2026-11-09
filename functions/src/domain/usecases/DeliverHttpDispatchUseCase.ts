import {
  describeHttpTarget,
  HTTP_CALLBACK_RESPONSE_PARAM,
  HTTP_RETRY_AFTER_MAX_SECONDS,
  HTTP_RETRY_DELAYS_MINUTES,
  HTTP_TIMEOUT_MAX_SECONDS,
} from '../schema/httpRequestSpec';
import { redactSecrets } from '../schema/httpConnection';
import { deliverHttp, publicHeaders, type HttpDeliveryDeps, type HttpDeliveryOutcome } from '../services/httpDelivery';
import type {
  HttpDispatchCallbackEvent,
  HttpDispatchRecord,
  HttpDispatchSummary,
  IHttpDispatchRepository,
} from '../repositories/IHttpDispatchRepository';

export interface DeliverHttpDispatchDeps {
  delivery: HttpDeliveryDeps;
  dispatches: IHttpDispatchRepository;
  now(): Date;
}

/**
 * - `skipped`: outro já reservou, ou o pedido já terminou (entrega duplicada do gatilho);
 * - `waiting`: falha passageira, nova tentativa agendada;
 * - `done` / `failed`: terminou, e o callback (se houver) foi publicado junto;
 * - `lost`: a reserva deixou de ser desta tentativa enquanto ela rodava — quem a tomou responde.
 */
export type DeliverHttpDispatchResult = 'skipped' | 'waiting' | 'done' | 'failed' | 'lost';

export type DeliverHttpDispatchUseCase = {
  execute: (tenantId: string, dispatchId: string) => Promise<DeliverHttpDispatchResult>;
};

/**
 * A reserva cobre a tentativa mais longa possível mais uma folga. Se a entrega morrer no meio (timeout
 * da function, deploy), o relógio devolve o pedido à fila quando ela vence — e a tentativa perdida conta.
 */
const LEASE_MS = (HTTP_TIMEOUT_MAX_SECONDS + 60) * 1000;

/** Status em que repetir pode dar outra resposta: o servidor está ocupado, caiu ou demorou. */
const isRetryableStatus = (status: number): boolean => status === 408 || status === 429 || status >= 500;

/** `Retry-After` em segundos ou como data HTTP. O que não se entende é ignorado. */
export const retryAfterSeconds = (value: string | undefined, now: Date): number | null => {
  const text = value?.trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);
  const at = Date.parse(text);
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - now.getTime()) / 1000));
};

/** A próxima tentativa: o intervalo da tabela, ou o que o servidor pediu se for mais — até um teto. */
export const nextRetryAt = (attempts: number, now: Date, retryAfter: number | null): Date => {
  const table = HTTP_RETRY_DELAYS_MINUTES;
  const base = table[Math.min(Math.max(attempts, 1) - 1, table.length - 1)] * 60_000;
  const asked = retryAfter === null ? 0 : Math.min(retryAfter, HTTP_RETRY_AFTER_MAX_SECONDS) * 1000;
  return new Date(now.getTime() + Math.max(base, asked));
};

interface Classified {
  summary: HttpDispatchSummary;
  retryable: boolean;
  headers: Record<string, string>;
  body: unknown;
  retryAfter: number | null;
}

const classify = (outcome: HttpDeliveryOutcome, record: HttpDispatchRecord, now: Date): Classified => {
  const empty = { headers: {}, body: null, retryAfter: null };
  if (outcome.kind === 'refused') {
    // A fronteira mudou enquanto o pedido esperava (domínio tirado da lista, credencial apagada):
    // repetir daria a mesma recusa.
    return {
      ...empty,
      retryable: false,
      summary: {
        ok: false, status: 0, durationMs: 0, timedOut: false,
        error: outcome.refusal.message,
        ...(outcome.refusal.messageParams ? { errorParams: outcome.refusal.messageParams } : {}),
      },
    };
  }
  if (outcome.kind === 'failed') {
    return {
      ...empty,
      retryable: outcome.failure !== 'too-large',
      summary: {
        ok: false, status: 0, durationMs: 0, timedOut: outcome.failure === 'timeout',
        error: outcome.message, errorParams: outcome.messageParams,
      },
    };
  }
  const { response } = outcome;
  const base = {
    headers: publicHeaders(response.headers),
    body: outcome.body,
    retryAfter: retryAfterSeconds(response.headers['retry-after'], now),
  };
  if (!outcome.ok) {
    return {
      ...base,
      retryable: isRetryableStatus(response.status),
      summary: {
        ok: false, status: response.status, durationMs: response.durationMs, timedOut: false,
        error: '@core.automation/step.http.status-failed',
        errorParams: { method: record.request.method, target: describeHttpTarget(new URL(record.request.url)), status: String(response.status) },
      },
    };
  }
  if (outcome.invalidJson) {
    return {
      ...base,
      retryable: false,
      summary: {
        ok: false, status: response.status, durationMs: response.durationMs, timedOut: false,
        error: '@core.automation/step.http.invalid-json',
        errorParams: { target: describeHttpTarget(new URL(record.request.url)) },
      },
    };
  }
  return { ...base, retryable: false, summary: { ok: true, status: response.status, durationMs: response.durationMs, timedOut: false, error: null } };
};

const callbackEvent = (
  record: HttpDispatchRecord,
  result: { summary: HttpDispatchSummary; headers: Record<string, string>; body: unknown },
): HttpDispatchCallbackEvent | undefined => {
  if (!record.callback) return undefined;
  return {
    payload: {
      __targetWorkflowId: record.callback.workflowId,
      __callDepth: record.callback.callDepth,
      ...record.callback.params,
      [HTTP_CALLBACK_RESPONSE_PARAM]: {
        ...result.summary,
        headers: result.headers,
        body: result.body,
        dispatchId: record.id,
        attempts: record.attempts,
      },
    },
    ...(record.actor ? { actor: record.actor } : {}),
  };
};

/**
 * Entrega UMA tentativa de um pedido da fila. Quem a chama é o gatilho do documento — a gravação que
 * põe o pedido em `queued` é o que o acorda, na criação e em cada nova tentativa.
 */
export const makeDeliverHttpDispatchUseCase = (deps: DeliverHttpDispatchDeps): DeliverHttpDispatchUseCase => ({
  execute: async (tenantId, dispatchId) => {
    const claimedAt = deps.now();
    const record = await deps.dispatches.claim(tenantId, dispatchId, claimedAt, new Date(claimedAt.getTime() + LEASE_MS));
    if (!record) return 'skipped';

    const finish = async (status: 'done' | 'failed', result: { summary: HttpDispatchSummary; headers: Record<string, string>; body: unknown }) => {
      const finished = await deps.dispatches.finish(
        tenantId, record.id, record.attempts, { status, summary: result.summary }, deps.now(), callbackEvent(record, result),
      );
      return finished ? status : 'lost';
    };

    // Uma entrega que morreu no meio deixou a tentativa contada; acabadas as tentativas, o pedido
    // termina aqui — o callback ainda fica sabendo.
    if (record.attempts > record.maxAttempts) {
      return finish('failed', {
        summary: {
          ok: false, status: 0, durationMs: 0, timedOut: false,
          error: '@core.automation/step.http.async.abandoned',
          errorParams: { attempts: String(record.maxAttempts) },
        },
        headers: {},
        body: null,
      });
    }

    const headers = { ...record.request.headers };
    // Repetir é o que a fila faz; a chave deixa o servidor que a entende reconhecer a repetição.
    headers['idempotency-key'] ??= record.id;
    const secretForms: string[] = [];
    const outcome = await deliverHttp(
      deps.delivery,
      tenantId,
      {
        method: record.request.method,
        url: new URL(record.request.url),
        headers,
        ...(record.request.body !== undefined ? { body: record.request.body } : {}),
      },
      {
        ...(record.connection ? { connection: record.connection } : {}),
        ...(record.responseType ? { responseType: record.responseType } : {}),
        timeoutMs: record.timeoutSeconds * 1000,
      },
      secretForms,
    );

    const now = deps.now();
    const raw = classify(outcome, record, now);
    const classified = secretForms.length === 0 ? raw : redactSecrets(raw, secretForms);

    if (classified.retryable && record.attempts < record.maxAttempts) {
      const rescheduled = await deps.dispatches.reschedule(
        tenantId, record.id, record.attempts, nextRetryAt(record.attempts, now, classified.retryAfter), classified.summary, now,
      );
      return rescheduled ? 'waiting' : 'lost';
    }
    return finish(classified.summary.ok ? 'done' : 'failed', classified);
  },
});
