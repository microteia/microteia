import { describe, expect, it } from 'vitest';
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
  const db = {
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
      const pending: [string, Record<string, unknown>][] = [];
      return {
        set: (target: { path: string }, data: Record<string, unknown>) => { pending.push([target.path, data]); },
        commit: async () => {
          const failure = failures.shift();
          if (failure !== undefined) throw failure;
          for (const [path, data] of pending) store[path] = data;
        },
      };
    },
  } as unknown as Firestore;
  return { db, store };
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
