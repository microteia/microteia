import { describe, it, expect } from 'vitest';
import { runWorkflowClockRound, syncWorkflowClockEntry } from './workflowClock';
import type { WorkflowClockDeps } from './workflowClock';
import type { IWorkflowClockRepository, WorkflowClockEntry } from '../repositories/IWorkflowClockRepository';

const key = (tenantId: string, definitionId: string): string => `${tenantId}/${definitionId}`;

const makeDeps = (now: string, officeTimeZone = 'America/Sao_Paulo') => {
  const entries = new Map<string, WorkflowClockEntry>();
  const fired: { entry: WorkflowClockEntry; payload: Record<string, unknown>; next: Date | null }[] = [];
  const firedOccurrences = new Set<string>();
  const clock = { now: new Date(now) };

  const repository: IWorkflowClockRepository = {
    find: async (tenantId, definitionId) => entries.get(key(tenantId, definitionId)) ?? null,
    save: async (entry) => {
      entries.set(key(entry.tenantId, entry.definitionId), entry);
    },
    remove: async (tenantId, definitionId) => {
      entries.delete(key(tenantId, definitionId));
    },
    due: async (at, limit) =>
      [...entries.values()]
        .filter((entry) => entry.nextRunAt.getTime() <= at.getTime())
        .sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime())
        .slice(0, limit),
    fire: async (entry, payload, next) => {
      const occurrence = `${entry.definitionId}@${entry.nextRunAt.getTime()}`;
      const stored = entries.get(key(entry.tenantId, entry.definitionId));
      if (!stored || stored.nextRunAt.getTime() !== entry.nextRunAt.getTime() || firedOccurrences.has(occurrence)) return 'stale';
      firedOccurrences.add(occurrence);
      fired.push({ entry, payload, next });
      if (next) entries.set(key(entry.tenantId, entry.definitionId), { ...stored, nextRunAt: next, timeZone: entry.timeZone });
      else entries.delete(key(entry.tenantId, entry.definitionId));
      return 'fired';
    },
  };

  const deps: WorkflowClockDeps = {
    repository,
    officeTimeZone: async () => officeTimeZone,
    now: () => clock.now,
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  };
  return { deps, entries, fired, clock };
};

const scheduled = (cron: string, extra: Record<string, unknown> = {}) => ({
  enabled: true,
  eventName: 'schedule',
  schedule: { cron, ...extra },
});

describe('syncWorkflowClockEntry', () => {
  it('cria a entrada com o próximo disparo no fuso do escritório', async () => {
    const { deps, entries } = makeDeps('2026-10-12T12:00:00Z');
    await syncWorkflowClockEntry('t1', 'wf', scheduled('0 8 * * *'), deps);
    const entry = entries.get('t1/wf');
    expect(entry?.nextRunAt.toISOString()).toBe('2026-10-13T11:00:00.000Z');
    expect(entry?.timeZone).toBe('America/Sao_Paulo');
    expect(entry?.declaredTimeZone).toBeNull();
  });

  it('o fuso declarado sobrescreve o do escritório', async () => {
    const { deps, entries } = makeDeps('2026-10-12T12:00:00Z');
    await syncWorkflowClockEntry('t1', 'wf', scheduled('0 8 * * *', { timeZone: 'UTC' }), deps);
    expect(entries.get('t1/wf')?.nextRunAt.toISOString()).toBe('2026-10-13T08:00:00.000Z');
  });

  it('regravar sem mudar o horário não mexe no próximo disparo', async () => {
    const { deps, entries, clock } = makeDeps('2026-10-12T12:00:00Z');
    await syncWorkflowClockEntry('t1', 'wf', scheduled('0 8 * * *'), deps);
    clock.now = new Date('2026-10-13T10:59:00Z');
    await syncWorkflowClockEntry('t1', 'wf', scheduled('0 8 * * *'), deps);
    expect(entries.get('t1/wf')?.nextRunAt.toISOString()).toBe('2026-10-13T11:00:00.000Z');
  });

  it('apaga a entrada quando a automação é desligada, apagada, muda de gatilho ou fica inválida', async () => {
    for (const after of [
      null,
      { ...scheduled('0 8 * * *'), enabled: false },
      { ...scheduled('0 8 * * *'), eventName: 'medico.saved' },
      scheduled('*/5 * * * *'),
      scheduled('não é cron'),
    ]) {
      const { deps, entries } = makeDeps('2026-10-12T12:00:00Z');
      await syncWorkflowClockEntry('t1', 'wf', scheduled('0 8 * * *'), deps);
      await syncWorkflowClockEntry('t1', 'wf', after, deps);
      expect(entries.has('t1/wf')).toBe(false);
    }
  });
});

describe('runWorkflowClockRound', () => {
  it('dispara o que venceu, com o payload do momento, e agenda o seguinte', async () => {
    const { deps, fired, entries, clock } = makeDeps('2026-10-12T12:00:00Z');
    await syncWorkflowClockEntry('t1', 'wf', scheduled('0 8 * * *'), deps);
    await syncWorkflowClockEntry('t2', 'other', scheduled('0 9 * * *'), deps);

    clock.now = new Date('2026-10-13T11:02:00Z');
    const result = await runWorkflowClockRound(deps);

    expect(result).toMatchObject({ fired: 1, stale: 0, failed: 0, saturated: false });
    expect(fired[0].payload).toEqual({ scheduledFor: new Date('2026-10-13T11:00:00Z'), firedAt: clock.now });
    expect(entries.get('t1/wf')?.nextRunAt.toISOString()).toBe('2026-10-14T11:00:00.000Z');
    expect(entries.get('t2/other')?.nextRunAt.toISOString()).toBe('2026-10-13T12:00:00.000Z');
  });

  it('relógio parado dispara a ocorrência atrasada UMA vez, e segue do agora', async () => {
    const { deps, fired, entries, clock } = makeDeps('2026-10-12T12:00:00Z');
    await syncWorkflowClockEntry('t1', 'wf', scheduled('0 8 * * *'), deps);

    clock.now = new Date('2026-10-16T15:00:00Z');
    await runWorkflowClockRound(deps);
    await runWorkflowClockRound(deps);

    expect(fired).toHaveLength(1);
    expect(entries.get('t1/wf')?.nextRunAt.toISOString()).toBe('2026-10-17T11:00:00.000Z');
  });

  it('a troca de fuso do escritório vale a partir do disparo seguinte', async () => {
    const { deps, entries, clock } = makeDeps('2026-10-12T12:00:00Z');
    await syncWorkflowClockEntry('t1', 'wf', scheduled('0 8 * * *'), deps);
    deps.officeTimeZone = async () => 'UTC';

    clock.now = new Date('2026-10-13T11:00:00Z');
    await runWorkflowClockRound(deps);
    expect(entries.get('t1/wf')?.nextRunAt.toISOString()).toBe('2026-10-14T08:00:00.000Z');
    expect(entries.get('t1/wf')?.timeZone).toBe('UTC');
  });

  it('uma falha não leva o turno das outras', async () => {
    const { deps, entries, clock } = makeDeps('2026-10-12T12:00:00Z');
    await syncWorkflowClockEntry('t1', 'bad', scheduled('0 8 * * *'), deps);
    await syncWorkflowClockEntry('t2', 'good', scheduled('0 8 * * *'), deps);
    const realFire = deps.repository.fire;
    deps.repository.fire = async (entry, payload, next) => {
      if (entry.definitionId === 'bad') throw new Error('boom');
      return realFire(entry, payload, next);
    };

    clock.now = new Date('2026-10-13T11:00:00Z');
    const result = await runWorkflowClockRound(deps);
    expect(result).toMatchObject({ fired: 1, failed: 1 });
    expect(entries.get('t2/good')?.nextRunAt.toISOString()).toBe('2026-10-14T11:00:00.000Z');
  });
});
