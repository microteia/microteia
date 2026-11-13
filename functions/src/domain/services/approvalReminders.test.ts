import { describe, it, expect } from 'vitest';
import { remindDueApprovals } from './approvalReminders';
import type { IWorkflowTaskRepository } from '../repositories/IWorkflowTaskRepository';
import type { DispatchNotificationRequest, DispatchNotificationUseCase } from '../usecases/DispatchNotificationUseCase';
import type { WorkflowTask } from '../schema/workflowTask';

const NOW = new Date('2026-11-20T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const task = (over: Partial<WorkflowTask> = {}): WorkflowTask => ({
  id: 'x_s1', tenantId: 't1', workflowDefinitionId: 'wf', executionId: 'x', stepId: 's1',
  title: 'Aprovar contrato', message: '', assigneeIds: ['ana', 'bia'], guestIds: ['cliente'],
  outcomes: [{ key: 'approved', label: 'Aprovar' }], status: 'open', createdAt: new Date(NOW.getTime() - 3 * DAY),
  dueAt: new Date(NOW.getTime() + 10 * DAY), target: { collection: 'contratos', recordId: 'c1' },
  remindEveryDays: 2, nextReminderAt: new Date(NOW.getTime() - 60_000), reminders: 1,
  ...over,
});

const harness = (due: WorkflowTask[], claims: boolean[] = due.map(() => true)) => {
  const claimed: { id: string; next: Date | null }[] = [];
  const sent: DispatchNotificationRequest[] = [];
  const tasks = {
    dueReminders: async () => due,
    claimReminder: async (one: WorkflowTask, next: Date | null) => {
      claimed.push({ id: one.id, next });
      return claims[claimed.length - 1] ?? false;
    },
  } as unknown as IWorkflowTaskRepository;
  const dispatch = { execute: async (request: DispatchNotificationRequest) => { sent.push(request); return { issues: [] }; } } as unknown as DispatchNotificationUseCase;
  return { claimed, sent, deps: { tasks, dispatch, now: () => NOW } };
};

describe('lembrete das aprovações', () => {
  it('lembra só quem ainda não decidiu — membros pela caixa, convidados pelo registro no portal', async () => {
    const { sent, deps } = harness([task({ quorum: 2, votes: { bia: { outcome: 'approved', name: 'Bia', at: NOW, comment: '', via: 'member' } } })]);
    expect(await remindDueApprovals(deps, 50)).toBe(1);
    const members = sent.find((one) => one.audience !== 'portal');
    const guests = sent.find((one) => one.audience === 'portal');
    expect(members).toMatchObject({ recipientIds: ['ana'], link: 'workflow-tasks', dedupKey: 'x_s1:remind:2', message: '@core.automation/task.remind.message' });
    expect(guests).toMatchObject({ recipientIds: ['cliente'], target: { collection: 'contratos', recordId: 'c1' }, dedupKey: 'x_s1:remind:2:portal' });
  });

  it('o próximo conta a partir de AGORA; o que cairia no prazo encerra os lembretes', async () => {
    const { claimed, deps } = harness([
      task(),
      task({ id: 'y_s1', dueAt: new Date(NOW.getTime() + DAY) }),
    ]);
    await remindDueApprovals(deps, 50);
    expect(claimed).toEqual([
      { id: 'x_s1', next: new Date(NOW.getTime() + 2 * DAY) },
      { id: 'y_s1', next: null },
    ]);
  });

  it('o lembrete que outra volta já reservou não sai de novo', async () => {
    const { sent, deps } = harness([task()], [false]);
    expect(await remindDueApprovals(deps, 50)).toBe(0);
    expect(sent).toEqual([]);
  });

  it('sem convidados, só os membros; sem pendentes, ninguém — mas o lembrete conta', async () => {
    const onlyMembers = harness([task({ guestIds: [] })]);
    await remindDueApprovals(onlyMembers.deps, 50);
    expect(onlyMembers.sent.map((one) => one.audience ?? 'members')).toEqual(['members']);

    const everyoneVoted = harness([task({ assigneeIds: ['ana'], guestIds: [], votes: { ana: { outcome: 'approved', name: 'Ana', at: NOW, comment: '', via: 'member' } } })]);
    expect(await remindDueApprovals(everyoneVoted.deps, 50)).toBe(1);
    expect(everyoneVoted.sent).toEqual([]);
  });

  it('o aviso que falha não derruba a varredura das outras tarefas', async () => {
    const { deps, claimed } = harness([task(), task({ id: 'z_s1' })]);
    deps.dispatch = { execute: async () => { throw new Error('e-mail fora'); } } as unknown as DispatchNotificationUseCase;
    expect(await remindDueApprovals(deps, 50)).toBe(2);
    expect(claimed.map((one) => one.id)).toEqual(['x_s1', 'z_s1']);
  });
});
