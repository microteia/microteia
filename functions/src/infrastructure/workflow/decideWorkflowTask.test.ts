import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkflowTask } from '../../domain/schema/workflowTask';

const state = vi.hoisted(() => ({
  task: null as unknown,
  entry: null as unknown,
  decision: { ok: true } as unknown,
  annotate: 'annotated' as 'annotated' | 'stale',
  expired: [] as string[],
  resumed: [] as unknown[],
}));

vi.mock('../di/container', () => ({
  getDI: () => ({
    getWorkflowTaskRepository: () => ({
      findById: async () => state.task,
      expire: async (_t: string, id: string) => { state.expired.push(id); },
      decide: async () => state.decision,
    }),
    getWorkflowClockDeps: () => ({
      repository: {
        find: async () => state.entry,
        annotateResume: async () => state.annotate,
      },
      resume: async (entry: unknown) => { state.resumed.push(entry); },
    }),
  }),
}));

import { decideWorkflowTask } from './decideWorkflowTask';

const task = { id: 'x_s1', executionId: 'x', stepId: 's1' } as WorkflowTask;
const entry = { kind: 'resume', taskId: 'x_s1', outputs: { s1: { timedOut: false } } };
const input = { tenantId: 't1', taskId: 'x_s1', outcome: 'approved', userId: 'ana', userName: 'Ana' };

beforeEach(() => {
  Object.assign(state, {
    task,
    entry,
    decision: { ok: true, closed: true, task: { ...task, outcome: 'approved', decidedBy: 'ana', decidedByName: 'Ana', comment: '' } },
    annotate: 'annotated',
    expired: [],
    resumed: [],
  });
});

describe('decidir uma tarefa — a mesma porta da caixa e do MCP', () => {
  it('a decisão entra nas saídas do passo e a MESMA execução retoma, marcada como decidida', async () => {
    expect(await decideWorkflowTask(input)).toEqual({ ok: true });
    expect(state.resumed).toHaveLength(1);
    expect(state.resumed[0]).toMatchObject({ decided: true, outputs: { s1: { outcome: 'approved', decidedBy: 'ana', taskId: 'x_s1' } } });
  });

  it('tarefa que não existe é recusada sem tocar no relógio', async () => {
    state.task = null;
    expect(await decideWorkflowTask(input)).toEqual({ ok: false, error: '@core.automation/task.refused.not-found', code: 'not-found' });
    expect(state.resumed).toEqual([]);
  });

  it('sem a continuação, o prazo venceu: a tarefa fecha como expirada e a decisão é recusada', async () => {
    state.entry = null;
    expect(await decideWorkflowTask(input)).toMatchObject({ ok: false, error: '@core.automation/task.refused.expired' });
    expect(state.expired).toEqual(['x_s1']);
  });

  it('quem não está designado é recusado pela transação, com o motivo dela', async () => {
    state.decision = { ok: false, reason: 'not-assignee' };
    expect(await decideWorkflowTask(input)).toMatchObject({ ok: false, error: '@core.automation/task.refused.not-assignee' });
    expect(state.resumed).toEqual([]);
  });

  it('o relógio tomou a continuação entre a decisão e a anotação: não retoma duas vezes', async () => {
    state.annotate = 'stale';
    expect(await decideWorkflowTask(input)).toMatchObject({ ok: false, error: '@core.automation/task.refused.expired' });
    expect(state.resumed).toEqual([]);
  });

  it('com quórum, o voto que não fecha conta e NÃO retoma: a execução segue esperando os outros', async () => {
    state.decision = { ok: true, closed: false, task: { ...task, votes: {} } };
    expect(await decideWorkflowTask({ ...input, via: 'portal' })).toEqual({ ok: true, pending: true });
    expect(state.resumed).toEqual([]);
  });

  it('o voto que fecha retoma com todos os votos nas saídas', async () => {
    const at = new Date('2026-11-13T12:00:00Z');
    state.decision = {
      ok: true,
      closed: true,
      task: {
        ...task, outcome: 'approved', decidedBy: 'ana', decidedByName: 'Ana', comment: '',
        votes: {
          ana: { outcome: 'approved', name: 'Ana', at, comment: '', via: 'member' },
          cliente: { outcome: 'approved', name: 'Cliente', at, comment: 'ok', via: 'portal' },
        },
      },
    };
    expect(await decideWorkflowTask(input)).toEqual({ ok: true });
    expect(state.resumed[0]).toMatchObject({
      outputs: { s1: { outcome: 'approved', votes: [
        { decidedBy: 'ana', outcome: 'approved', via: 'member' },
        { decidedBy: 'cliente', outcome: 'approved', comment: 'ok', via: 'portal' },
      ] } },
    });
  });
});
