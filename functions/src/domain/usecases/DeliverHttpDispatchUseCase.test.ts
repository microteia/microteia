import { describe, it, expect } from 'vitest';
import {
  makeDeliverHttpDispatchUseCase,
  nextRetryAt,
  retryAfterSeconds,
} from './DeliverHttpDispatchUseCase';
import {
  HttpClientError,
  type HttpClientFailureCode,
  type HttpIncomingResponse,
  type HttpOutgoingRequest,
  type IHttpClient,
} from '../repositories/IHttpClient';
import type {
  HttpDispatchCallbackEvent,
  HttpDispatchInput,
  HttpDispatchRecord,
  HttpDispatchSummary,
  IHttpDispatchRepository,
} from '../repositories/IHttpDispatchRepository';
import type { IHttpCredentialRepository } from '../repositories/IHttpCredentialRepository';
import type { HttpPolicy } from '../services/httpDelivery';

const NOW = new Date('2026-11-09T12:00:00Z');
const MINUTE = 60_000;

type Answer = Partial<HttpIncomingResponse> | HttpClientFailureCode;

class ScriptedClient implements IHttpClient {
  readonly sent: HttpOutgoingRequest[] = [];
  constructor(private readonly answers: Answer[]) {}
  async send(request: HttpOutgoingRequest): Promise<HttpIncomingResponse> {
    this.sent.push(request);
    const answer = this.answers[Math.min(this.sent.length - 1, this.answers.length - 1)];
    if (typeof answer === 'string') throw new HttpClientError(answer, 'boom');
    return { status: 200, headers: {}, bodyText: '', durationMs: 7, ...answer };
  }
}

/** A fila em memória, com as MESMAS regras de posse do repositório Firestore. */
class MemoryDispatches implements IHttpDispatchRepository {
  readonly docs = new Map<string, HttpDispatchRecord & { nextAttemptAt?: Date; last?: HttpDispatchSummary }>();
  readonly events: HttpDispatchCallbackEvent[] = [];

  async enqueue(_tenantId: string, input: HttpDispatchInput): Promise<string> {
    const id = `d${this.docs.size + 1}`;
    this.docs.set(id, { ...input, id, status: 'queued', attempts: 0 });
    return id;
  }
  async claim(_tenantId: string, id: string, _now: Date, leaseUntil: Date): Promise<HttpDispatchRecord | null> {
    const doc = this.docs.get(id);
    if (!doc || doc.status !== 'queued') return null;
    Object.assign(doc, { status: 'sending', attempts: doc.attempts + 1, nextAttemptAt: leaseUntil });
    return { ...doc };
  }
  async reschedule(_t: string, id: string, attempt: number, retryAt: Date, last: HttpDispatchSummary): Promise<boolean> {
    const doc = this.docs.get(id);
    if (!doc || doc.status !== 'sending' || doc.attempts !== attempt) return false;
    Object.assign(doc, { status: 'waiting', nextAttemptAt: retryAt, last });
    return true;
  }
  async finish(
    _t: string, id: string, attempt: number,
    final: { status: 'done' | 'failed'; summary: HttpDispatchSummary }, _now: Date, callback?: HttpDispatchCallbackEvent,
  ): Promise<boolean> {
    const doc = this.docs.get(id);
    if (!doc || doc.status !== 'sending' || doc.attempts !== attempt) return false;
    Object.assign(doc, { status: final.status, last: final.summary, nextAttemptAt: undefined });
    if (callback) this.events.push(callback);
    return true;
  }
  async requeueDue(): Promise<number> {
    return 0;
  }
  /** O que o relógio faria quando a espera vence. */
  requeue(id: string): void {
    const doc = this.docs.get(id);
    if (doc) doc.status = 'queued';
  }
}

const OPEN: HttpPolicy = { allowedHosts: ['api.exemplo.com'], allowedPorts: [] };
const NONE: IHttpCredentialRepository = { findByKey: async () => null };

const input = (over: Partial<HttpDispatchInput> = {}): HttpDispatchInput => ({
  request: { method: 'POST', url: 'https://api.exemplo.com/v1/pedidos', headers: { accept: 'application/json' }, body: '{"a":1}' },
  timeoutSeconds: 15,
  maxAttempts: 3,
  origin: { workflowId: 'wf', executionId: 'ex' },
  ...over,
});

const setup = async (answers: Answer[], over: Partial<HttpDispatchInput> = {}, options: { policy?: HttpPolicy; credentials?: IHttpCredentialRepository } = {}) => {
  const client = new ScriptedClient(answers);
  const dispatches = new MemoryDispatches();
  let policy = options.policy ?? OPEN;
  const useCase = makeDeliverHttpDispatchUseCase({
    delivery: { client, policyOf: async () => policy, credentials: options.credentials ?? NONE },
    dispatches,
    now: () => NOW,
  });
  const id = await dispatches.enqueue('t1', input(over));
  return {
    client, dispatches, id,
    deliver: () => useCase.execute('t1', id),
    setPolicy: (next: HttpPolicy) => { policy = next; },
  };
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Partial<HttpIncomingResponse> => ({
  status,
  headers: { 'content-type': 'application/json', ...headers },
  bodyText: JSON.stringify(body),
});

describe('fila HTTP — a entrega', () => {
  it('resposta 2xx encerra o pedido, e o callback recebe o resultado em `response` com os parâmetros fixados', async () => {
    const { deliver, dispatches, id, client } = await setup([json({ protocolo: 'P-9' }, 201)], {
      callback: { workflowId: 'wf-retorno', params: { pedido: 'p1' }, callDepth: 1 },
      actor: { userId: 'u1', name: 'Ana', photoURL: '', via: 'ui' },
    });
    expect(await deliver()).toBe('done');
    expect(client.sent).toHaveLength(1);
    expect(dispatches.docs.get(id)?.status).toBe('done');
    expect(dispatches.events).toEqual([{
      payload: {
        __targetWorkflowId: 'wf-retorno',
        __callDepth: 1,
        pedido: 'p1',
        response: {
          ok: true, status: 201, durationMs: 7, timedOut: false, error: null,
          headers: { 'content-type': 'application/json' },
          body: { protocolo: 'P-9' },
          dispatchId: id,
          attempts: 1,
        },
      },
      actor: { userId: 'u1', name: 'Ana', photoURL: '', via: 'ui' },
    }]);
  });

  it('sem callback, encerra sem publicar evento nenhum', async () => {
    const { deliver, dispatches } = await setup([json({})]);
    expect(await deliver()).toBe('done');
    expect(dispatches.events).toHaveLength(0);
  });

  it('a chave de idempotência vai no pedido — e a do autor vence', async () => {
    const first = await setup([json({})]);
    await first.deliver();
    expect(first.client.sent[0].headers['idempotency-key']).toBe(first.id);

    const own = await setup([json({})], { request: { ...input().request, headers: { 'idempotency-key': 'meu-123' } } });
    await own.deliver();
    expect(own.client.sent[0].headers['idempotency-key']).toBe('meu-123');
  });

  it('5xx, 429, 408, rede e tempo esgotado: espera e tenta de novo; o callback só sai no fim', async () => {
    for (const answer of [json({}, 503), json({}, 429), json({}, 408), 'network', 'timeout'] as Answer[]) {
      const { deliver, dispatches, id } = await setup([answer], {
        callback: { workflowId: 'wf-retorno', params: {}, callDepth: 1 },
      });
      expect(await deliver()).toBe('waiting');
      const doc = dispatches.docs.get(id);
      expect(doc?.status).toBe('waiting');
      expect(doc?.nextAttemptAt).toEqual(new Date(NOW.getTime() + MINUTE));
      expect(dispatches.events).toHaveLength(0);
    }
  });

  it('a resposta 4xx não se repete: falha, e o callback fica sabendo', async () => {
    const { deliver, dispatches, client } = await setup([json({ erro: 'campo' }, 422)], {
      callback: { workflowId: 'wf-retorno', params: {}, callDepth: 1 },
    });
    expect(await deliver()).toBe('failed');
    expect(client.sent).toHaveLength(1);
    const response = dispatches.events[0].payload.response as Record<string, unknown>;
    expect(response).toMatchObject({ ok: false, status: 422, error: '@core.automation/step.http.status-failed', body: { erro: 'campo' } });
  });

  it('resposta grande demais não se repete', async () => {
    const { deliver } = await setup(['too-large']);
    expect(await deliver()).toBe('failed');
  });

  it('acabadas as tentativas, o pedido falha com a última resposta', async () => {
    const { deliver, dispatches, id, client } = await setup([json({}, 500)], {
      maxAttempts: 2,
      callback: { workflowId: 'wf-retorno', params: {}, callDepth: 1 },
    });
    expect(await deliver()).toBe('waiting');
    dispatches.requeue(id);
    expect(await deliver()).toBe('failed');
    expect(client.sent).toHaveLength(2);
    expect(dispatches.events[0].payload.response).toMatchObject({ ok: false, status: 500, attempts: 2 });
  });

  it('o intervalo cresce a cada tentativa, e o `Retry-After` maior que ele é respeitado', async () => {
    const { deliver, dispatches, id } = await setup([json({}, 503), json({}, 503, { 'retry-after': '1200' })], { maxAttempts: 5 });
    await deliver();
    dispatches.requeue(id);
    await deliver();
    expect(dispatches.docs.get(id)?.nextAttemptAt).toEqual(new Date(NOW.getTime() + 20 * MINUTE));
  });

  it('a fronteira é conferida de novo: domínio tirado da lista enquanto esperava falha sem chamar', async () => {
    const { deliver, setPolicy, client, dispatches, id } = await setup([json({})]);
    setPolicy({ allowedHosts: ['outro.com'], allowedPorts: [] });
    expect(await deliver()).toBe('failed');
    expect(client.sent).toHaveLength(0);
    expect(dispatches.docs.get(id)?.last?.error).toBe('@core.automation/step.http.host-not-allowed');
  });

  it('a credencial é aplicada NA ENTREGA, e o segredo que a API ecoa é apagado do callback', async () => {
    const SECRET = 'sk_live_eco';
    const credentials: IHttpCredentialRepository = {
      findByKey: async () => ({
        connection: { id: 'c1', key: 'crm', name: 'CRM', scheme: 'bearer', hosts: ['api.exemplo.com'], hasSecret: true },
        secret: SECRET,
      }),
    };
    const { deliver, client, dispatches } = await setup([json({ eco: `Bearer ${SECRET}` })], {
      connection: 'crm',
      callback: { workflowId: 'wf-retorno', params: {}, callDepth: 1 },
    }, { credentials });
    expect(await deliver()).toBe('done');
    expect(client.sent[0].headers.authorization).toBe(`Bearer ${SECRET}`);
    expect(JSON.stringify(dispatches.events)).not.toContain(SECRET);
  });

  it('a entrega duplicada do gatilho não chama duas vezes', async () => {
    const { deliver, client } = await setup([json({})]);
    expect(await deliver()).toBe('done');
    expect(await deliver()).toBe('skipped');
    expect(client.sent).toHaveLength(1);
  });

  it('a entrega que morreu no meio conta a tentativa; esgotadas, o pedido termina sem chamar de novo', async () => {
    const { deliver, dispatches, id, client } = await setup([json({})], {
      maxAttempts: 1,
      callback: { workflowId: 'wf-retorno', params: {}, callDepth: 1 },
    });
    const doc = dispatches.docs.get(id);
    if (doc) doc.attempts = 1;
    expect(await deliver()).toBe('failed');
    expect(client.sent).toHaveLength(0);
    expect(dispatches.events[0].payload.response).toMatchObject({ error: '@core.automation/step.http.async.abandoned' });
  });
});

describe('fila HTTP — o intervalo entre tentativas', () => {
  it('`Retry-After` em segundos ou como data; o que não se entende é ignorado', () => {
    expect(retryAfterSeconds('120', NOW)).toBe(120);
    expect(retryAfterSeconds(new Date(NOW.getTime() + 90_000).toUTCString(), NOW)).toBe(90);
    expect(retryAfterSeconds('amanhã', NOW)).toBeNull();
    expect(retryAfterSeconds(undefined, NOW)).toBeNull();
  });

  it('segue a tabela, fica no último degrau, e o pedido do servidor tem teto de uma hora', () => {
    const after = (attempts: number, retryAfter: number | null = null) => (nextRetryAt(attempts, NOW, retryAfter).getTime() - NOW.getTime()) / MINUTE;
    expect([1, 2, 3, 4, 5, 9].map((n) => after(n))).toEqual([1, 5, 15, 60, 180, 180]);
    expect(after(1, 600)).toBe(10);
    expect(after(1, 99_999)).toBe(60);
  });
});
