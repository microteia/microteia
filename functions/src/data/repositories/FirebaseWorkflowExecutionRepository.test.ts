import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import type { WorkflowExecution } from '../../domain/entities/Workflow';
import { HISTORY_TEXT_MAX_CHARACTERS, HISTORY_TOO_LARGE_MESSAGE } from '../../domain/services/executionHistory';
import { FirebaseWorkflowExecutionRepository } from './FirebaseWorkflowExecutionRepository';

const at = new Date('2026-11-17T12:00:00Z');

/** `set` falha com os erros da fila, na ordem, e depois grava. */
const makeFakeDb = (failures: unknown[]) => {
  const written: Record<string, unknown>[] = [];
  const db = {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({
            set: async (data: Record<string, unknown>) => {
              const failure = failures.shift();
              if (failure !== undefined) throw failure;
              written.push(data);
            },
          }),
        }),
      }),
    }),
  } as unknown as Firestore;
  return { db, written };
};

const execution = (): WorkflowExecution => ({
  id: 'ex1',
  tenantId: 't1',
  workflowDefinitionId: 'wf1',
  eventId: 'e1',
  status: 'SUCCESS',
  startedAt: at,
  finishedAt: at,
  logs: [{ level: 'SUCCESS', message: '@core.automation/run.step.done', at, stepId: 'read', outputs: { text: 'z'.repeat(10_000) } }],
  outputs: { text: 'z'.repeat(10_000) },
});

const messagesOf = (data: Record<string, unknown> | undefined) =>
  (data?.logs as { message: string }[]).map((entry) => entry.message);

describe('FirebaseWorkflowExecutionRepository.create', () => {
  it('grava o histórico com os textos cortados', async () => {
    const { db, written } = makeFakeDb([]);
    await new FirebaseWorkflowExecutionRepository(db).create(execution());
    const logs = written[0].logs as { outputs: { text: string } }[];
    expect(logs[0].outputs.text).toMatch(new RegExp(`^z{${HISTORY_TEXT_MAX_CHARACTERS}}… \\[\\+8000\\]$`));
    expect(messagesOf(written[0])).not.toContain(HISTORY_TOO_LARGE_MESSAGE);
  });

  it('o documento recusado por tamanho é regravado só com as mensagens — a execução não fica sem desfecho', async () => {
    const { db, written } = makeFakeDb([Object.assign(new Error('exceeds the maximum allowed size'), { code: 3 })]);
    await new FirebaseWorkflowExecutionRepository(db).create(execution());
    expect(written).toHaveLength(1);
    expect(messagesOf(written[0])).toEqual(['@core.automation/run.step.done', HISTORY_TOO_LARGE_MESSAGE]);
    expect(written[0].outputs).toEqual({});
    expect(written[0].status).toBe('SUCCESS');
  });

  it('outro erro não vira histórico pobre: sobe', async () => {
    const { db, written } = makeFakeDb([Object.assign(new Error('unavailable'), { code: 14 })]);
    await expect(new FirebaseWorkflowExecutionRepository(db).create(execution())).rejects.toThrow('unavailable');
    expect(written).toHaveLength(0);
  });
});
