import { describe, it, expect } from 'vitest';
import { DATE_REACHED_PAGE_SIZE, dateReachedOnSave, runWorkflowClockRound, syncWorkflowClockEntry } from './workflowClock';
import type { WorkflowClockDeps } from './workflowClock';
import type {
  ClaimedEvent,
  DateReachedClockEntry,
  IWorkflowClockRepository,
  WorkflowClockEntry,
} from '../repositories/IWorkflowClockRepository';
import type { WorkflowDefinition, WorkflowEvent } from '../entities/Workflow';

const key = (tenantId: string, definitionId: string): string => `${tenantId}/${definitionId}`;

interface FakeRecord {
  id: string;
  dueDate: Date;
}

const makeDeps = (now: string, officeTimeZone = 'America/Sao_Paulo') => {
  const entries = new Map<string, WorkflowClockEntry>();
  const fired: { entry: WorkflowClockEntry; payload: Record<string, unknown>; next: Date | null }[] = [];
  const firedOccurrences = new Set<string>();
  const marks = new Set<string>();
  const published: ClaimedEvent[] = [];
  const records: FakeRecord[] = [];
  const deactivated = new Set<string>();
  const clock = { now: new Date(now) };
  const dateFields = new Map<string, { collection: string; fields: string[] }>([
    ['prazo', { collection: 'prazos', fields: ['dueDate'] }],
  ]);

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
    advance: async (entry, patch) => {
      const stored = entries.get(key(entry.tenantId, entry.definitionId));
      if (!stored || stored.nextRunAt.getTime() !== entry.nextRunAt.getTime()) return 'stale';
      const next = { ...stored, nextRunAt: patch.nextRunAt, timeZone: patch.timeZone } as WorkflowClockEntry;
      if (next.kind === 'dateReached') {
        if (patch.cursorDay !== undefined) next.cursorDay = patch.cursorDay;
        if (patch.page !== undefined) next.page = patch.page;
      }
      entries.set(key(entry.tenantId, entry.definitionId), next);
      return 'fired';
    },
    recordsInRange: async (_tenantId, _collection, _field, from, to, after, limit) =>
      records
        .filter((record) => record.dueDate >= from && record.dueDate < to)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.id.localeCompare(b.id))
        .filter((record) => !after
          || record.dueDate.getTime() > after.value.getTime()
          || (record.dueDate.getTime() === after.value.getTime() && record.id > after.id))
        .slice(0, limit)
        .map((record) => ({ id: record.id, value: record.dueDate, data: { dueDate: record.dueDate } })),
    claimAndPublish: async (_tenantId, markId, _expiresAt, event) => {
      if (marks.has(markId)) return false;
      marks.add(markId);
      published.push(event);
      return true;
    },
  };

  const deps: WorkflowClockDeps = {
    repository,
    officeTimeZone: async () => officeTimeZone,
    deactivatedPluginIds: async () => deactivated,
    resolveDateField: async (_tenantId, prefix, field) => {
      const known = dateFields.get(prefix);
      return known && known.fields.includes(field) ? { collection: known.collection } : null;
    },
    now: () => clock.now,
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  };
  return { deps, entries, fired, clock, marks, published, records, deactivated };
};

const scheduled = (cron: string, extra: Record<string, unknown> = {}) => ({
  enabled: true,
  eventName: 'schedule',
  schedule: { cron, ...extra },
});

const dated = (offset: string, at = '08:00', extra: Record<string, unknown> = {}) => ({
  enabled: true,
  eventName: 'prazo.dateReached',
  dateReached: { field: 'dueDate', offset, at },
  ...extra,
});

/** Um DIA gravado como o formulário grava: meio-dia em UTC. */
const day = (value: string): Date => new Date(`${value}T12:00:00Z`);

describe('syncWorkflowClockEntry — horário', () => {
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

describe('runWorkflowClockRound — horário', () => {
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

  it('a automação de extensão desligada não dispara, mas o relógio segue', async () => {
    const { deps, fired, entries, clock, deactivated } = makeDeps('2026-10-12T12:00:00Z');
    await syncWorkflowClockEntry('t1', 'wf', { ...scheduled('0 8 * * *'), ownerPluginIds: ['com.x.off'] }, deps);
    deactivated.add('com.x.off');

    clock.now = new Date('2026-10-13T11:00:00Z');
    await runWorkflowClockRound(deps);
    expect(fired).toHaveLength(0);
    expect(entries.get('t1/wf')?.nextRunAt.toISOString()).toBe('2026-10-14T11:00:00.000Z');
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

describe('gatilho de data — o relógio', () => {
  it('a primeira volta olha só o dia que a hora alcança: o passado não dispara', async () => {
    const { deps, entries } = makeDeps('2026-10-12T12:00:00Z');
    await syncWorkflowClockEntry('t1', 'wf', dated('-3d'), deps);
    const entry = entries.get('t1/wf') as DateReachedClockEntry;
    expect(entry.kind).toBe('dateReached');
    expect(entry.nextRunAt.toISOString()).toBe('2026-10-13T11:00:00.000Z');
    expect(entry.cursorDay).toBe('2026-10-15');
  });

  it('às 8h de 13/10, com -3d, dispara os registros com data 16/10 — uma vez cada', async () => {
    const { deps, published, records, clock } = makeDeps('2026-10-12T12:00:00Z');
    records.push({ id: 'a', dueDate: day('2026-10-16') }, { id: 'b', dueDate: day('2026-10-17') }, { id: 'c', dueDate: day('2026-10-15') });
    await syncWorkflowClockEntry('t1', 'wf', dated('-3d'), deps);

    clock.now = new Date('2026-10-13T11:01:00Z');
    await runWorkflowClockRound(deps);
    await runWorkflowClockRound(deps);

    expect(published.map((event) => event.payload.id)).toEqual(['a']);
    expect(published[0]).toMatchObject({ name: 'prazo.dateReached', target: 'wf' });
  });

  it('a data que muda dispara de novo, para a data nova', async () => {
    const { deps, published, records, clock } = makeDeps('2026-10-12T12:00:00Z');
    records.push({ id: 'a', dueDate: day('2026-10-13') });
    await syncWorkflowClockEntry('t1', 'wf', dated('0d'), deps);

    clock.now = new Date('2026-10-13T11:01:00Z');
    await runWorkflowClockRound(deps);
    records[0].dueDate = day('2026-10-14');
    clock.now = new Date('2026-10-14T11:01:00Z');
    await runWorkflowClockRound(deps);

    expect(published).toHaveLength(2);
  });

  it('relógio parado recupera os dias perdidos, até o teto', async () => {
    const { deps, published, records, clock } = makeDeps('2026-10-12T12:00:00Z');
    records.push({ id: 'a', dueDate: day('2026-10-13') }, { id: 'b', dueDate: day('2026-10-15') });
    await syncWorkflowClockEntry('t1', 'wf', dated('0d'), deps);

    clock.now = new Date('2026-10-16T11:01:00Z');
    await runWorkflowClockRound(deps);
    expect(published.map((event) => event.payload.id).sort()).toEqual(['a', 'b']);
  });

  it('o dia com mais registros que a página continua na volta seguinte', async () => {
    const { deps, published, records, entries, clock } = makeDeps('2026-10-12T12:00:00Z');
    for (let index = 0; index < DATE_REACHED_PAGE_SIZE + 5; index += 1) {
      records.push({ id: `r${String(index).padStart(4, '0')}`, dueDate: day('2026-10-13') });
    }
    await syncWorkflowClockEntry('t1', 'wf', dated('0d'), deps);

    clock.now = new Date('2026-10-13T11:01:00Z');
    await runWorkflowClockRound(deps);
    expect(published).toHaveLength(DATE_REACHED_PAGE_SIZE);
    expect((entries.get('t1/wf') as DateReachedClockEntry).page).not.toBeNull();

    await runWorkflowClockRound(deps);
    expect(published).toHaveLength(DATE_REACHED_PAGE_SIZE + 5);
    const settled = entries.get('t1/wf') as DateReachedClockEntry;
    expect(settled.page).toBeNull();
    expect(settled.cursorDay).toBe('2026-10-13');
    expect(settled.nextRunAt.toISOString()).toBe('2026-10-14T11:00:00.000Z');
  });

  it('o campo que não é data da tela não consulta nada, e o relógio segue', async () => {
    const { deps, published, records, entries, clock } = makeDeps('2026-10-12T12:00:00Z');
    records.push({ id: 'a', dueDate: day('2026-10-13') });
    await syncWorkflowClockEntry('t1', 'wf', { ...dated('0d'), dateReached: { field: 'titulo', offset: '0d' } }, deps);

    clock.now = new Date('2026-10-13T11:01:00Z');
    await runWorkflowClockRound(deps);
    expect(published).toHaveLength(0);
    expect(entries.get('t1/wf')?.nextRunAt.toISOString()).toBe('2026-10-14T11:00:00.000Z');
  });
});

describe('gatilho de data — a gravação depois da hora', () => {
  const definition = (overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition => ({
    id: 'wf',
    tenantId: 't1',
    name: 'Aviso',
    eventName: 'prazo.dateReached',
    dateReached: { field: 'dueDate', offset: '0d', at: '08:00' },
    enabled: true,
    version: 1,
    condition: { kind: 'AlwaysTrue' },
    steps: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const saved = (dueDate: Date): WorkflowEvent => ({
    id: 'ev',
    tenantId: 't1',
    name: 'prazo.saved',
    payload: { id: 'a', dueDate, changeType: 'created' },
    timestamp: new Date(),
  });

  it('o registro que chega ao dia depois da hora dispara na hora, uma vez', async () => {
    const { deps, published, clock } = makeDeps('2026-10-13T15:00:00Z');
    await dateReachedOnSave(saved(day('2026-10-13')), [definition()], deps);
    await dateReachedOnSave(saved(day('2026-10-13')), [definition()], deps);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ name: 'prazo.dateReached', target: 'wf' });

    clock.now = new Date('2026-10-13T16:00:00Z');
    expect(await dateReachedOnSave(saved(day('2026-10-13')), [definition()], deps)).toBe(0);
  });

  it('antes da hora, quem dispara é o relógio; e dia passado ou futuro não dispara', async () => {
    const { deps, published } = makeDeps('2026-10-13T10:00:00Z');
    await dateReachedOnSave(saved(day('2026-10-13')), [definition()], deps);
    const later = makeDeps('2026-10-13T15:00:00Z');
    await dateReachedOnSave(saved(day('2026-10-12')), [definition()], later.deps);
    await dateReachedOnSave(saved(day('2026-10-14')), [definition()], later.deps);
    expect(published).toHaveLength(0);
    expect(later.published).toHaveLength(0);
  });

  it('o deslocamento conta: com -1d, o prazo de amanhã dispara hoje', async () => {
    const { deps, published } = makeDeps('2026-10-13T15:00:00Z');
    await dateReachedOnSave(saved(day('2026-10-14')), [definition({ dateReached: { field: 'dueDate', offset: '-1d' } })], deps);
    expect(published).toHaveLength(1);
  });

  it('a mesma marca serve às duas metades: o que a gravação disparou o relógio não repete', async () => {
    const { deps, published, records, clock } = makeDeps('2026-10-12T12:00:00Z');
    await syncWorkflowClockEntry('t1', 'wf', dated('0d'), deps);
    clock.now = new Date('2026-10-13T15:00:00Z');
    records.push({ id: 'a', dueDate: day('2026-10-13') });
    await dateReachedOnSave(saved(day('2026-10-13')), [definition()], deps);
    await runWorkflowClockRound(deps);
    expect(published).toHaveLength(1);
  });
});
