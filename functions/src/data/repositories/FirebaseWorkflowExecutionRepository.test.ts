import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { WorkflowExecution } from '../../domain/entities/Workflow';
import { EXECUTION_HISTORY_SCHEMA } from '../../domain/schema/executionHistory';
import { HISTORY_TEXT_MAX_CHARACTERS, HISTORY_TOO_LARGE_MESSAGE } from '../../domain/services/executionHistory';
import { FirebaseWorkflowExecutionRepository } from './FirebaseWorkflowExecutionRepository';

const at = new Date('2026-11-17T12:00:00Z');

/**
 * Firestore em memória, indexado pelo caminho. `commit` falha com os erros da fila, na ordem, e depois
 * grava — o lote inteiro ou nada, como o de verdade.
 */
const makeFakeDb = (failures: unknown[] = [], seed: Record<string, Record<string, unknown>> = {}) => {
  const store: Record<string, Record<string, unknown>> = { ...seed };
  const ref = (path: string): unknown => ({
    path,
    collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }),
    get: async () => ({ exists: path in store, id: path.split('/').at(-1), data: () => store[path], ref: ref(path) }),
  });
  const millis = (value: unknown) => (value as Timestamp).toMillis();
  const groupQuery = (name: string, field: string, bound: unknown, size = Infinity, after?: string) => ({
    orderBy: () => groupQuery(name, field, bound, size, after),
    limit: (n: number) => groupQuery(name, field, bound, n, after),
    startAfter: (snap: { ref: { path: string } }) => groupQuery(name, field, bound, size, snap.ref.path),
    get: async () => {
      const matches = Object.entries(store)
        .filter(([path, data]) => path.split('/').at(-2) === name && data[field] instanceof Timestamp && millis(data[field]) <= millis(bound))
        .sort(([pa, a], [pb, b]) => millis(a[field]) - millis(b[field]) || pa.localeCompare(pb));
      const start = after === undefined ? 0 : matches.findIndex(([path]) => path === after) + 1;
      queries.push(after ?? '');
      return { docs: matches.slice(start, start + size).map(([path, data]) => ({ id: path.split('/').at(-1), data: () => data, ref: ref(path) })) };
    },
  });
  const queries: string[] = [];
  const db = {
    collectionGroup: (name: string) => ({
      where: (field: string, _op: string, bound: unknown) => groupQuery(name, field, bound),
    }),
    collection: (name: string) => ({
      doc: (id: string) => {
        const base = `${name}/${id}`;
        return {
          collection: (sub: string) => ({
            doc: (docId: string) => ref(`${base}/${sub}/${docId}`),
            where: (field: string, _op: string, value: unknown) => ({
              limit: () => ({
                get: async () => ({
                  docs: Object.entries(store)
                    .filter(([path, data]) => path.split('/').length === 4 && path.startsWith(`${base}/${sub}/`) && data[field] === value)
                    .map(([path, data]) => ({ id: path.split('/').at(-1), data: () => data, ref: ref(path) })),
                }),
              }),
            }),
          }),
        };
      },
    }),
    batch: () => {
      const pending: [string, Record<string, unknown> | null][] = [];
      return {
        set: (target: { path: string }, data: Record<string, unknown>) => { pending.push([target.path, data]); },
        delete: (target: { path: string }) => { pending.push([target.path, null]); },
        commit: async () => {
          const failure = failures.shift();
          if (failure !== undefined) throw failure;
          for (const [path, data] of pending) {
            if (data === null) delete store[path];
            else store[path] = data;
          }
        },
      };
    },
  } as unknown as Firestore;
  return { db, store, queries };
};

const SUMMARY = 'tenants/t1/workflow_executions/ex1';
const DETAIL = `${SUMMARY}/detail/run`;

const execution = (): WorkflowExecution => ({
  id: 'ex1',
  tenantId: 't1',
  workflowDefinitionId: 'wf1',
  eventId: 'e1',
  status: 'SUCCESS',
  startedAt: at,
  finishedAt: at,
  actorId: 'u1',
  logs: [{ level: 'SUCCESS', message: '@core.automation/run.step.done', at, stepId: 'read', outputs: { text: 'z'.repeat(10_000) } }],
  outputs: { text: 'z'.repeat(10_000) },
});

const messagesOf = (data: Record<string, unknown> | undefined) =>
  (data?.logs as { message: string }[]).map((entry) => entry.message);

describe('FirebaseWorkflowExecutionRepository.create', () => {
  it('o resumo não carrega dado nenhum do que a automação tocou; o detalhe carrega, cortado', async () => {
    const { db, store } = makeFakeDb();
    await new FirebaseWorkflowExecutionRepository(db).create(execution());
    expect(Object.keys(store[SUMMARY]).sort()).toEqual(
      ['actorId', 'eventId', 'finishedAt', 'resumeAt', 'schema', 'startedAt', 'status', 'workflowDefinitionId'],
    );
    expect(store[SUMMARY].schema).toBe(EXECUTION_HISTORY_SCHEMA);
    expect(store[SUMMARY].actorId).toBe('u1');
    const logs = store[DETAIL].logs as { outputs: { text: string } }[];
    expect(logs[0].outputs.text).toMatch(new RegExp(`^z{${HISTORY_TEXT_MAX_CHARACTERS}}… \\[\\+8000\\]$`));
    expect(messagesOf(store[DETAIL])).not.toContain(HISTORY_TOO_LARGE_MESSAGE);
  });

  it('o lote recusado por tamanho é regravado só com as mensagens — a execução não fica sem desfecho', async () => {
    const { db, store } = makeFakeDb([Object.assign(new Error('exceeds the maximum allowed size'), { code: 3 })]);
    await new FirebaseWorkflowExecutionRepository(db).create(execution());
    expect(messagesOf(store[DETAIL])).toEqual(['@core.automation/run.step.done', HISTORY_TOO_LARGE_MESSAGE]);
    expect(store[DETAIL].outputs).toEqual({});
    expect(store[SUMMARY].status).toBe('SUCCESS');
  });

  it('outro erro não vira histórico pobre: sobe, e nada é gravado', async () => {
    const { db, store } = makeFakeDb([Object.assign(new Error('unavailable'), { code: 14 })]);
    await expect(new FirebaseWorkflowExecutionRepository(db).create(execution())).rejects.toThrow('unavailable');
    expect(store).toEqual({});
  });
});

describe('FirebaseWorkflowExecutionRepository — leitura', () => {
  it('junta resumo e detalhe', async () => {
    const { db } = makeFakeDb();
    const repository = new FirebaseWorkflowExecutionRepository(db);
    await repository.create(execution());
    const read = await repository.findById('t1', 'ex1');
    expect(read?.actorId).toBe('u1');
    expect(read?.logs.map((entry) => entry.stepId)).toEqual(['read']);
    expect(String(read?.outputs.text)).toMatch(/… \[\+8000\]$/);
    expect(await repository.findByEventId('t1', 'e1')).toHaveLength(1);
  });

  it('o histórico anterior ao resumo, num documento só, continua legível', async () => {
    const { db } = makeFakeDb([], {
      [SUMMARY]: {
        workflowDefinitionId: 'wf1', eventId: 'e1', status: 'FAILED', startedAt: at,
        logs: [{ level: 'ERROR', message: 'antigo', at }], outputs: { ok: false },
      },
    });
    const read = await new FirebaseWorkflowExecutionRepository(db).findById('t1', 'ex1');
    expect(read?.logs.map((entry) => entry.message)).toEqual(['antigo']);
    expect(read?.outputs).toEqual({ ok: false });
    expect(read?.actorId).toBeUndefined();
  });
});

describe('FirebaseWorkflowExecutionRepository.purgeExpired', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  const daysAgo = (days: number) => Timestamp.fromMillis(now.getTime() - days * 24 * 60 * 60 * 1000);
  const always = () => true;

  it('apaga resumo e detalhe do vencido, e deixa o recente e o que ainda espera', async () => {
    const { db, store } = makeFakeDb([], {
      'tenants/t1/workflow_executions/velho': { schema: 2, startedAt: daysAgo(120), finishedAt: daysAgo(120) },
      'tenants/t1/workflow_executions/velho/detail/run': { logs: [] },
      'tenants/t1/workflow_executions/recente': { schema: 2, startedAt: daysAgo(10), finishedAt: daysAgo(10) },
      'tenants/t1/workflow_executions/recente/detail/run': { logs: [] },
      'tenants/t2/workflow_executions/esperando': { schema: 2, startedAt: daysAgo(200), resumeAt: daysAgo(-30) },
      'tenants/t2/workflow_executions/esperando/detail/run': { logs: [] },
      'tenants/t2/workflow_executions/retomada': { schema: 2, startedAt: daysAgo(200), finishedAt: daysAgo(5) },
    });
    const result = await new FirebaseWorkflowExecutionRepository(db).purgeExpired(now, always);
    expect(result).toEqual({ deleted: 1, complete: true });
    expect(Object.keys(store).sort()).toEqual([
      'tenants/t1/workflow_executions/recente',
      'tenants/t1/workflow_executions/recente/detail/run',
      'tenants/t2/workflow_executions/esperando',
      'tenants/t2/workflow_executions/esperando/detail/run',
      'tenants/t2/workflow_executions/retomada',
    ]);
  });

  it('o histórico antigo, sem `schema` e com tudo num documento, vence pela mesma conta', async () => {
    const { db, store } = makeFakeDb([], {
      'tenants/t1/workflow_executions/antigo': { startedAt: daysAgo(400), finishedAt: daysAgo(400), logs: [{ message: 'x' }] },
    });
    await new FirebaseWorkflowExecutionRepository(db).purgeExpired(now, always);
    expect(store).toEqual({});
  });

  it('não toca um homônimo fora do lugar do histórico', async () => {
    const homonym = 'tenants/t1/pedidos/p1/workflow_executions/x';
    const { db, store } = makeFakeDb([], { [homonym]: { startedAt: daysAgo(400) } });
    await new FirebaseWorkflowExecutionRepository(db).purgeExpired(now, always);
    expect(Object.keys(store)).toEqual([homonym]);
  });

  it('pagina, passa pelas que esperam e para quando o tempo acaba', async () => {
    const seed: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < 150; i += 1) seed[`tenants/t1/workflow_executions/w${i}`] = { startedAt: daysAgo(300), resumeAt: daysAgo(-1) };
    for (let i = 0; i < 250; i += 1) seed[`tenants/t1/workflow_executions/v${i}`] = { startedAt: daysAgo(200), finishedAt: daysAgo(200) };

    const all = makeFakeDb([], { ...seed });
    expect(await new FirebaseWorkflowExecutionRepository(all.db).purgeExpired(now, always)).toEqual({ deleted: 250, complete: true });
    expect(Object.keys(all.store)).toHaveLength(150);

    const once = makeFakeDb([], { ...seed });
    let pages = 0;
    const result = await new FirebaseWorkflowExecutionRepository(once.db).purgeExpired(now, () => (pages += 1) === 1);
    expect(result).toEqual({ deleted: 50, complete: false });
    expect(once.queries).toHaveLength(1);
  });
});

describe('FirebaseWorkflowExecutionRepository — execução interrompida (#6)', () => {
  /** Só o que `markRunning` e `closeAbandoned` tocam; a consulta e a precondição de verdade foram exercitadas no emulador. */
  const makeSweepDb = (docs: { path: string; updateTime: string; stale?: boolean }[]) => {
    const writes: { op: string; path: string; data: Record<string, unknown>; precondition?: unknown }[] = [];
    const filters: unknown[][] = [];
    const ref = (path: string): unknown => ({
      path,
      collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }),
      set: async (data: Record<string, unknown>) => { writes.push({ op: 'set', path, data }); },
    });
    const query = {
      where: (...args: unknown[]) => { filters.push(args); return query; },
      orderBy: () => query,
      limit: (n: number) => { filters.push(['limit', n]); return query; },
      get: async () => ({ docs: docs.map((doc) => ({ ref: ref(doc.path), updateTime: doc.updateTime })) }),
    };
    const db = {
      collectionGroup: () => query,
      collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
      batch: () => {
        const pending: typeof writes = [];
        return {
          update: (target: { path: string }, data: Record<string, unknown>, precondition: unknown) => {
            pending.push({ op: 'update', path: target.path, data, precondition });
          },
          set: (target: { path: string }, data: Record<string, unknown>) => { pending.push({ op: 'set', path: target.path, data }); },
          commit: async () => {
            const stale = pending.some((write) => docs.find((doc) => doc.path === write.path)?.stale);
            if (stale) throw Object.assign(new Error('FAILED_PRECONDITION'), { code: 9 });
            writes.push(...pending);
          },
        };
      },
    } as unknown as Firestore;
    return { db, writes, filters };
  };

  it('markRunning grava só o resumo, RUNNING e sem fim — o detalhe vem no desfecho', async () => {
    const { db, writes } = makeSweepDb([]);
    await new FirebaseWorkflowExecutionRepository(db).markRunning({
      id: 'ex1', tenantId: 't1', workflowDefinitionId: 'wf', eventId: 'ev', status: 'RUNNING', startedAt: at, logs: [], outputs: {},
    });
    expect(writes).toEqual([{
      op: 'set',
      path: SUMMARY,
      data: {
        schema: EXECUTION_HISTORY_SCHEMA,
        workflowDefinitionId: 'wf',
        eventId: 'ev',
        status: 'RUNNING',
        startedAt: Timestamp.fromDate(at),
        finishedAt: null,
        resumeAt: null,
        actorId: null,
      },
    }]);
  });

  it('closeAbandoned fecha como falha a RUNNING antiga, ignora o homônimo e deixa a que terminou entre a consulta e a gravação', async () => {
    const { db, writes, filters } = makeSweepDb([
      { path: 'tenants/t1/workflow_executions/dead', updateTime: 'u1' },
      { path: 'tenants/t1/things/x/workflow_executions/homonym', updateTime: 'u2' },
      { path: 'tenants/t2/workflow_executions/finished-meanwhile', updateTime: 'u3', stale: true },
    ]);
    const before = new Date('2026-11-17T11:42:00Z');

    const closed = await new FirebaseWorkflowExecutionRepository(db).closeAbandoned(before, at, '@core.automation/run.interrupted', 50);

    expect(closed).toBe(1);
    expect(filters).toEqual([['status', '==', 'RUNNING'], ['startedAt', '<=', Timestamp.fromDate(before)], ['limit', 50]]);
    expect(writes).toEqual([
      {
        op: 'update',
        path: 'tenants/t1/workflow_executions/dead',
        data: { status: 'FAILED', finishedAt: Timestamp.fromDate(at) },
        precondition: { lastUpdateTime: 'u1' },
      },
      {
        op: 'set',
        path: 'tenants/t1/workflow_executions/dead/detail/run',
        data: { logs: [{ level: 'ERROR', message: '@core.automation/run.interrupted', at: Timestamp.fromDate(at) }], outputs: {} },
      },
    ]);
  });
});
