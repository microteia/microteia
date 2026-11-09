import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';
import { getDb, initFirebase } from '../functions/src/infrastructure/firebase/initFirebase';
import { FirestoreHttpDispatchRepository } from '../functions/src/data/repositories/FirestoreHttpDispatchRepository';
import type { HttpDispatchInput } from '../functions/src/domain/repositories/IHttpDispatchRepository';

/**
 * A fila do passo HTTP assíncrono. Duas provas no mesmo emulador:
 * - as REGRAS: só o servidor toca a fila — o pedido carrega dado de registro já resolvido;
 * - o REPOSITÓRIO de verdade, pelo Admin SDK: a reserva, a posse, o fim com o callback na mesma
 *   transação e a varredura por `nextAttemptAt`. É o que a fila em memória dos testes de unidade imita,
 *   e um defeito aqui pararia a fila em silêncio.
 */
let env: RulesTestEnvironment;

const NOW = new Date('2026-11-09T12:00:00Z');
const MINUTE = 60_000;
const at = (minutes: number) => new Date(NOW.getTime() + minutes * MINUTE);

const input: HttpDispatchInput = {
  request: { method: 'POST', url: 'https://api.exemplo.com/v1', headers: { accept: 'application/json' }, body: '{}' },
  timeoutSeconds: 15,
  maxAttempts: 2,
  callback: { workflowId: 'wf-retorno', params: { pedido: 'p1', vazio: undefined }, callDepth: 1 },
  origin: { workflowId: 'wf', executionId: 'ex' },
};

beforeAll(async () => {
  env = await testEnv();
  process.env.GCLOUD_PROJECT = 'demo-microteia';
  initFirebase();
});
afterAll(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { gestor: {}, integrador: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: { [TENANT]: { gestor: ['automation.manage'], integrador: ['integrations.manage'] } },
    records: { [TENANT]: { 'http_dispatches/d1': { status: 'queued', attempts: 0 } } },
  });
});

describe('a fila HTTP — regras', () => {
  it('ninguém do navegador lê nem grava — nem o dono, nem quem gerencia automações ou integrações', async () => {
    for (const uid of ['dono', 'gestor', 'integrador']) {
      const ref = doc(asUser(env, uid), `tenants/${TENANT}/http_dispatches/d1`);
      await assertFails(getDoc(ref));
      await assertFails(updateDoc(ref, { status: 'done' }));
      await assertFails(setDoc(doc(asUser(env, uid), `tenants/${TENANT}/http_dispatches/novo`), { status: 'queued' }));
    }
  });
});

describe('a fila HTTP — repositório no Firestore', () => {
  const repo = () => new FirestoreHttpDispatchRepository(getDb());
  const raw = async (id: string) => (await getDb().doc(`tenants/${TENANT}/http_dispatches/${id}`).get()).data();

  it('nasce na fila com prazo para alguém pegar e validade de 7 dias', async () => {
    const id = await repo().enqueue(TENANT, input, NOW);
    const data = await raw(id);
    expect(data?.status).toBe('queued');
    expect(data?.attempts).toBe(0);
    expect(data?.nextAttemptAt.toDate()).toEqual(at(10));
    expect(data?.expiresAt.toDate()).toEqual(at(7 * 24 * 60));
    expect(data?.callback.params).toEqual({ pedido: 'p1' });
  });

  it('a reserva é de UMA entrega: a segunda recebe nada', async () => {
    const id = await repo().enqueue(TENANT, input, NOW);
    const [first, second] = await Promise.all([repo().claim(TENANT, id, NOW, at(3)), repo().claim(TENANT, id, NOW, at(3))]);
    const claimed = [first, second].filter(Boolean);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ id, status: 'sending', attempts: 1, request: input.request, callback: { workflowId: 'wf-retorno' } });
    expect((await raw(id))?.nextAttemptAt.toDate()).toEqual(at(3));
  });

  it('encerrar grava o resumo, tira o pedido da varredura e publica o callback na mesma transação', async () => {
    const id = await repo().enqueue(TENANT, input, NOW);
    await repo().claim(TENANT, id, NOW, at(3));
    const summary = { ok: true, status: 200, durationMs: 5, timedOut: false, error: null };
    expect(await repo().finish(TENANT, id, 1, { status: 'done', summary }, NOW, { payload: { __targetWorkflowId: 'wf-retorno', response: { ok: true } } })).toBe(true);

    const data = await raw(id);
    expect(data?.status).toBe('done');
    expect(data?.last).toEqual(summary);
    expect(data?.nextAttemptAt).toBeUndefined();
    const events = await getDb().collection(`tenants/${TENANT}/workflow_events`).get();
    expect(events.docs.map((one) => [one.get('name'), one.get('payload')])).toEqual([
      ['workflow.called', { __targetWorkflowId: 'wf-retorno', response: { ok: true } }],
    ]);
  });

  it('a tentativa que perdeu a reserva não encerra nem reagenda', async () => {
    const id = await repo().enqueue(TENANT, input, NOW);
    await repo().claim(TENANT, id, NOW, at(3));
    const summary = { ok: false, status: 503, durationMs: 5, timedOut: false, error: 'x' };
    expect(await repo().reschedule(TENANT, id, 2, at(5), summary, NOW)).toBe(false);
    expect(await repo().finish(TENANT, id, 2, { status: 'failed', summary }, NOW)).toBe(false);
    expect((await raw(id))?.status).toBe('sending');
    expect((await getDb().collection(`tenants/${TENANT}/workflow_events`).get()).size).toBe(0);
  });

  it('a varredura devolve à fila o que venceu — espera, reserva perdida, pedido esquecido — e só isso', async () => {
    const waiting = await repo().enqueue(TENANT, input, NOW);
    await repo().claim(TENANT, waiting, NOW, at(3));
    await repo().reschedule(TENANT, waiting, 1, at(5), { ok: false, status: 503, durationMs: 1, timedOut: false, error: 'x' }, NOW);
    const crashed = await repo().enqueue(TENANT, input, NOW);
    await repo().claim(TENANT, crashed, NOW, at(3));
    const forgotten = await repo().enqueue(OTHER_TENANT, input, NOW);
    const later = await repo().enqueue(TENANT, input, at(30));
    const done = await repo().enqueue(TENANT, input, NOW);
    await repo().claim(TENANT, done, NOW, at(3));
    await repo().finish(TENANT, done, 1, { status: 'done', summary: { ok: true, status: 200, durationMs: 1, timedOut: false, error: null } }, NOW);

    expect(await repo().requeueDue(at(11), 50)).toBe(3);
    expect((await raw(waiting))?.status).toBe('queued');
    expect((await raw(crashed))?.status).toBe('queued');
    expect((await getDb().doc(`tenants/${OTHER_TENANT}/http_dispatches/${forgotten}`).get()).get('status')).toBe('queued');
    expect((await raw(later))?.nextAttemptAt.toDate()).toEqual(at(40));
    expect((await raw(done))?.status).toBe('done');
    // Devolvido, ganha prazo novo — a próxima volta não o pega de novo.
    expect((await raw(waiting))?.nextAttemptAt.toDate()).toEqual(at(21));
    expect(await repo().requeueDue(at(11), 50)).toBe(0);
  });
});
