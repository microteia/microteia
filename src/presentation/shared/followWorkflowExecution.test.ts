import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkflowExecution, WorkflowExecutionStatus } from '../../domain/entities/Workflow';
import {
  followWorkflowExecution,
  type SubscribeToExecutions,
  type WorkflowExecutionFollowEvent,
} from './followWorkflowExecution';

const execution = (eventId: string, status: WorkflowExecutionStatus): WorkflowExecution => ({
  id: `exec-${eventId}`,
  tenantId: 't1',
  workflowDefinitionId: 'wf',
  eventId,
  status,
  startedAt: new Date(0),
  logs: [],
  outputs: {},
});

const fakeSubscription = () => {
  let push: (executions: WorkflowExecution[]) => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const unsubscribe = vi.fn();
  const subscribe: SubscribeToExecutions = (onUpdate, onError) => {
    push = onUpdate;
    fail = onError;
    return unsubscribe;
  };
  return { subscribe, unsubscribe, push: (e: WorkflowExecution[]) => push(e), fail: (e: Error) => fail(e) };
};

describe('followWorkflowExecution', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('execução de 90 s: aos 60 s avisa que segue rodando, e aos 90 s entrega o resultado real', () => {
    const sub = fakeSubscription();
    const events: WorkflowExecutionFollowEvent[] = [];
    followWorkflowExecution(sub.subscribe, 'ev1', 60_000, (event) => events.push(event));

    sub.push([execution('ev1', 'RUNNING')]);
    vi.advanceTimersByTime(60_000);
    expect(events).toEqual([{ kind: 'still-running' }]);
    expect(sub.unsubscribe).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30_000);
    sub.push([execution('ev1', 'SUCCESS')]);
    expect(events.map((event) => event.kind)).toEqual(['still-running', 'finished']);
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('falha de verdade antes dos 60 s chega como finished FAILED, sem aviso de espera', () => {
    const sub = fakeSubscription();
    const events: WorkflowExecutionFollowEvent[] = [];
    followWorkflowExecution(sub.subscribe, 'ev1', 60_000, (event) => events.push(event));

    sub.push([execution('ev1', 'FAILED')]);
    vi.advanceTimersByTime(120_000);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'finished', execution: { status: 'FAILED' } });
  });

  it('assinatura que cai vira untracked, nunca finished', () => {
    const sub = fakeSubscription();
    const events: WorkflowExecutionFollowEvent[] = [];
    followWorkflowExecution(sub.subscribe, 'ev1', 60_000, (event) => events.push(event));

    sub.fail(new Error('permission-denied'));
    vi.advanceTimersByTime(120_000);
    expect(events).toEqual([{ kind: 'untracked', error: new Error('permission-denied') }]);
  });

  it('ignora as execuções de outros eventos', () => {
    const sub = fakeSubscription();
    const events: WorkflowExecutionFollowEvent[] = [];
    followWorkflowExecution(sub.subscribe, 'ev1', 60_000, (event) => events.push(event));

    sub.push([execution('other', 'FAILED')]);
    expect(events).toEqual([]);
  });

  it('encerrar o acompanhamento cancela a assinatura e o aviso de espera', () => {
    const sub = fakeSubscription();
    const events: WorkflowExecutionFollowEvent[] = [];
    const stop = followWorkflowExecution(sub.subscribe, 'ev1', 60_000, (event) => events.push(event));

    stop();
    vi.advanceTimersByTime(60_000);
    sub.push([execution('ev1', 'SUCCESS')]);
    expect(events).toEqual([]);
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('assinatura que já responde terminada na chamada é encerrada mesmo assim', () => {
    const unsubscribe = vi.fn();
    const events: WorkflowExecutionFollowEvent[] = [];
    const subscribe: SubscribeToExecutions = (onUpdate) => {
      onUpdate([execution('ev1', 'SUCCESS')]);
      return unsubscribe;
    };
    followWorkflowExecution(subscribe, 'ev1', 60_000, (event) => events.push(event));

    vi.advanceTimersByTime(60_000);
    expect(events.map((event) => event.kind)).toEqual(['finished']);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
