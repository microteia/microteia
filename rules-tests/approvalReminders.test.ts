import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { TENANT, seed, testEnv } from './helpers';
import { getDb, initFirebase } from '../functions/src/infrastructure/firebase/initFirebase';
import { FirestoreWorkflowTaskRepository } from '../functions/src/data/repositories/FirestoreWorkflowTaskRepository';
import type { WorkflowTask } from '../functions/src/domain/schema/workflowTask';

/**
 * O lembrete das aprovações no REPOSITÓRIO de verdade, no emulador: a consulta de grupo das vencidas e a
 * reserva que faz cada lembrete sair uma vez só — é o que os testes de unidade imitam com um dublê.
 */
let env: RulesTestEnvironment;
const NOW = new Date('2026-11-20T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const task = (id: string, over: Partial<WorkflowTask> = {}): WorkflowTask => ({
  id, tenantId: TENANT, workflowDefinitionId: 'wf', executionId: id, stepId: 's1', title: 'Aprovar', message: '',
  assigneeIds: ['ana'], outcomes: [{ key: 'approved', label: 'Aprovar' }], status: 'open',
  createdAt: new Date(NOW.getTime() - DAY), dueAt: new Date(NOW.getTime() + 10 * DAY), target: null,
  remindEveryDays: 1, nextReminderAt: new Date(NOW.getTime() - 60_000),
  ...over,
});

beforeAll(async () => {
  env = await testEnv();
  process.env.GCLOUD_PROJECT = 'demo-microteia';
  initFirebase();
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, { owners: { [TENANT]: 'dono' } });
});

describe('lembrete das aprovações — repositório no Firestore', () => {
  it('a consulta traz só as abertas com lembrete vencido, as mais atrasadas primeiro', async () => {
    const repo = new FirestoreWorkflowTaskRepository(getDb());
    await repo.createIfAbsent(task('vencida-tarde', { nextReminderAt: new Date(NOW.getTime() - 60_000) }));
    await repo.createIfAbsent(task('vencida-cedo', { nextReminderAt: new Date(NOW.getTime() - 3_600_000) }));
    await repo.createIfAbsent(task('futura', { nextReminderAt: new Date(NOW.getTime() + DAY) }));
    await repo.createIfAbsent(task('sem-lembrete', { remindEveryDays: undefined, nextReminderAt: undefined }));
    const due = await repo.dueReminders(NOW, 10);
    expect(due.map((one) => one.id)).toEqual(['vencida-cedo', 'vencida-tarde']);
    expect(due[0]).toMatchObject({ tenantId: TENANT, remindEveryDays: 1, reminders: 0 });
  });

  it('a reserva move o próximo e conta; a segunda reserva do MESMO lembrete é recusada', async () => {
    const repo = new FirestoreWorkflowTaskRepository(getDb());
    await repo.createIfAbsent(task('t1'));
    const [seen] = await repo.dueReminders(NOW, 10);
    const next = new Date(NOW.getTime() + DAY);
    expect(await repo.claimReminder(seen, next)).toBe(true);
    expect(await repo.claimReminder(seen, next)).toBe(false);
    const stored = await repo.findById(TENANT, 't1');
    expect(stored).toMatchObject({ nextReminderAt: next, reminders: 1 });
    expect(await repo.dueReminders(NOW, 10)).toEqual([]);
  });

  it('a tarefa decidida não é lembrada, nem reservada', async () => {
    const repo = new FirestoreWorkflowTaskRepository(getDb());
    await repo.createIfAbsent(task('t2'));
    const [seen] = await repo.dueReminders(NOW, 10);
    await repo.decide(TENANT, 't2', { userId: 'ana', userName: 'Ana', outcome: 'approved', comment: '', at: NOW, via: 'member' });
    expect(await repo.dueReminders(NOW, 10)).toEqual([]);
    expect(await repo.claimReminder(seen, null)).toBe(false);
  });
});

describe('repasse e escalonamento — repositório no Firestore', () => {
  it('o repasse troca o designado e fica registrado; o segundo repasse do mesmo autor é recusado', async () => {
    const repo = new FirestoreWorkflowTaskRepository(getDb());
    await repo.createIfAbsent(task('d1', { assigneeIds: ['ana', 'bia'] }));
    const first = await repo.delegate(TENANT, 'd1', { from: 'ana', fromName: 'Ana', to: 'caio', toName: 'Caio', reason: 'férias', at: NOW });
    expect(first).toMatchObject({ ok: true, task: { assigneeIds: ['caio', 'bia'] } });
    expect(await repo.delegate(TENANT, 'd1', { from: 'ana', fromName: 'Ana', to: 'davi', toName: 'Davi', reason: '', at: NOW }))
      .toEqual({ ok: false, reason: 'not-assignee' });
    const stored = await repo.findById(TENANT, 'd1');
    expect(stored?.delegations).toEqual([{ from: 'ana', fromName: 'Ana', to: 'caio', toName: 'Caio', reason: 'férias', at: NOW }]);
    // Quem recebeu decide; a decisão leva o repasse junto.
    expect(await repo.decide(TENANT, 'd1', { userId: 'caio', userName: 'Caio', outcome: 'approved', comment: '', at: NOW, via: 'member' }))
      .toMatchObject({ ok: true, closed: true });
  });

  it('a consulta traz as escalonáveis vencidas; a reserva acrescenta quem falta, uma vez só', async () => {
    const repo = new FirestoreWorkflowTaskRepository(getDb());
    await repo.createIfAbsent(task('e1', { assigneeIds: ['ana'], escalateAt: new Date(NOW.getTime() - 60_000), escalatePermission: 'x.aprovar' }));
    await repo.createIfAbsent(task('e2', { assigneeIds: ['ana'], escalateAt: new Date(NOW.getTime() + DAY), escalatePermission: 'x.aprovar' }));
    const due = await repo.dueEscalations(NOW, 10);
    expect(due.map((one) => one.id)).toEqual(['e1']);
    expect(await repo.escalate(due[0], ['gerente', 'ana'], NOW)).toEqual(['gerente']);
    expect(await repo.escalate(due[0], ['gerente'], NOW)).toBeNull();
    expect(await repo.findById(TENANT, 'e1')).toMatchObject({ assigneeIds: ['ana', 'gerente'], escalateAt: null, escalatedAt: NOW });
    expect(await repo.dueEscalations(NOW, 10)).toEqual([]);
  });
});

