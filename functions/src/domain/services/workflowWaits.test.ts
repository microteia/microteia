import { describe, it, expect } from 'vitest';
import { resumeWaitsForEvent } from './workflowWaits';
import type { WorkflowWaitDeps } from './workflowWaits';
import type { WorkflowEvent } from '../entities/Workflow';
import type { IWorkflowClockRepository, ResumeClockEntry } from '../repositories/IWorkflowClockRepository';

const NOW = new Date('2026-11-12T12:00:00Z');

const entry = (overrides: Partial<ResumeClockEntry> = {}): ResumeClockEntry => ({
  kind: 'resume',
  tenantId: 't1',
  definitionId: 'wf',
  executionId: 'exec-1',
  afterStepId: 'pago',
  lastStepId: 'pago',
  event: { id: 'ev-origem', name: 'faturas.saved', payload: { id: 'f1' }, timestamp: NOW },
  outputs: { pago: { matched: false, timedOut: true }, antes: { valor: 100 } },
  variables: {},
  actor: null,
  nextRunAt: new Date('2026-12-12T12:00:00Z'),
  timeZone: 'UTC',
  declaredTimeZone: null,
  ownerPluginIds: [],
  wait: { eventName: 'faturas.saved', recordId: 'f1' },
  ...overrides,
});

const event = (payload: Record<string, unknown>, id = 'ev-2', name = 'faturas.saved'): WorkflowEvent =>
  ({ id, tenantId: 't1', name, payload, timestamp: NOW });

const setup = (stored: ResumeClockEntry[]) => {
  const entries = new Map(stored.map((one) => [one.executionId, one]));
  const resumed: ResumeClockEntry[] = [];
  const clockRepository = {
    waitingFor: async (_tenantId: string, eventName: string, recordId: string) => [...entries.values()]
      .filter((one) => one.wait?.eventName === eventName && one.wait.recordId === recordId),
    annotateResume: async (one: ResumeClockEntry, outputs: ResumeClockEntry['outputs']) => {
      const current = entries.get(one.executionId);
      if (!current || current.decided) return 'stale';
      entries.set(one.executionId, { ...current, outputs, decided: true });
      return 'fired';
    },
  } as unknown as IWorkflowClockRepository;
  const deps: WorkflowWaitDeps = {
    clockRepository,
    services: { logger: { info: () => undefined, warn: () => undefined, error: () => undefined }, now: () => NOW },
    resume: async (one) => { resumed.push(one); },
  };
  return { deps, resumed, entries };
};

describe('resumeWaitsForEvent', () => {
  it('o evento do registro retoma a espera, com o registro como chegou nas saídas do passo', async () => {
    const { deps, resumed } = setup([entry()]);

    expect(await resumeWaitsForEvent(event({ id: 'f1', status: 'paid' }), deps)).toBe(1);
    expect(resumed).toHaveLength(1);
    expect(resumed[0].decided).toBe(true);
    expect(resumed[0].outputs.pago).toMatchObject({
      matched: true, timedOut: false, record: { id: 'f1', status: 'paid' }, eventId: 'ev-2', arrivedAt: NOW,
    });
    // As saídas dos outros passos atravessam a espera intactas.
    expect(resumed[0].outputs.antes).toEqual({ valor: 100 });
  });

  it('com condição, o evento que não a atende mantém a espera', async () => {
    const { deps, resumed } = setup([entry({ wait: { eventName: 'faturas.saved', recordId: 'f1', until: 'event.status == "paid"' } })]);

    expect(await resumeWaitsForEvent(event({ id: 'f1', status: 'open' }), deps)).toBe(0);
    expect(await resumeWaitsForEvent(event({ id: 'f1', status: 'paid' }, 'ev-3'), deps)).toBe(1);
    expect(resumed[0].outputs.pago.eventId).toBe('ev-3');
  });

  it('a condição que estoura não casa — não se segue por um caminho que não se sabe avaliar', async () => {
    const { deps } = setup([entry({ wait: { eventName: 'faturas.saved', recordId: 'f1', until: 'event.status ==' } })]);
    expect(await resumeWaitsForEvent(event({ id: 'f1', status: 'paid' }), deps)).toBe(0);
  });

  it('o evento que criou a espera não a encerra', async () => {
    const { deps } = setup([entry()]);
    expect(await resumeWaitsForEvent(event({ id: 'f1' }, 'ev-origem'), deps)).toBe(0);
  });

  it('dois eventos juntos retomam uma vez só', async () => {
    const { deps, resumed } = setup([entry()]);
    await Promise.all([
      resumeWaitsForEvent(event({ id: 'f1' }, 'ev-a'), deps),
      resumeWaitsForEvent(event({ id: 'f1' }, 'ev-b'), deps),
    ]);
    expect(resumed).toHaveLength(1);
  });

  it('evento de outro registro, de outro tipo ou sem registro não procura nada', async () => {
    const { deps } = setup([entry()]);
    expect(await resumeWaitsForEvent(event({ id: 'f2' }), deps)).toBe(0);
    expect(await resumeWaitsForEvent(event({ id: 'f1' }, 'ev-x', 'faturas.deleted'), deps)).toBe(0);
    expect(await resumeWaitsForEvent(event({ id: 'f1' }, 'ev-y', 'schedule'), deps)).toBe(0);
    expect(await resumeWaitsForEvent(event({}), deps)).toBe(0);
  });
});
