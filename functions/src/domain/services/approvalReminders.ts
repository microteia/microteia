import type { IWorkflowTaskRepository } from '../repositories/IWorkflowTaskRepository';
import type { DispatchNotificationUseCase } from '../usecases/DispatchNotificationUseCase';
import {
  MAX_APPROVAL_DAYS,
  WORKFLOW_TASKS_PAGE_KEY,
  nextApprovalReminder,
  pendingTaskVoters,
} from '../schema/workflowTask';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ApprovalReminderDeps {
  tasks: IWorkflowTaskRepository;
  dispatch: DispatchNotificationUseCase;
  now(): Date;
}

/**
 * LEMBRA quem ainda não decidiu as aprovações vencidas — a varredura que pega carona no relógio do kernel.
 *
 * Cada lembrete é RESERVADO antes de sair (`claimReminder`): duas voltas simultâneas não lembram duas vezes,
 * e a chave de cada aviso (`<tarefa>:remind:<n>`) é nova a cada lembrete — a repetição de um mesmo lembrete
 * é barrada pela chave, e o seguinte não é confundido com ele. Vai só a quem ainda deve a decisão: com
 * quórum, quem votou não é lembrado. O membro é levado à caixa; o convidado, ao registro no portal.
 *
 * A falha de um aviso não desfaz a reserva: o lembrete seguinte sai no intervalo seguinte, e um aviso a
 * menos é melhor que a mesma pessoa lembrada a cada cinco minutos.
 */
export const remindDueApprovals = async (deps: ApprovalReminderDeps, limit: number): Promise<number> => {
  const now = deps.now();
  let sent = 0;
  for (const task of await deps.tasks.dueReminders(now, limit)) {
    if (!task.remindEveryDays || !task.nextReminderAt) continue;
    const until = task.dueAt ?? new Date(task.createdAt.getTime() + MAX_APPROVAL_DAYS * DAY_MS);
    // O próximo conta a partir de AGORA, e não do lembrete atrasado: um relógio parado por horas não pode
    // disparar em sequência os lembretes que ficaram para trás.
    const next = nextApprovalReminder(now, task.remindEveryDays, until);
    if (!(await deps.tasks.claimReminder(task, next))) continue;

    const { members, guests } = pendingTaskVoters(task);
    const sequence = (task.reminders ?? 0) + 1;
    const common = {
      tenantId: task.tenantId,
      source: 'workflow' as const,
      workflowId: task.workflowDefinitionId,
      executionId: task.executionId,
      title: task.title,
      params: {},
      category: 'core.automation/task',
      recipientPermissions: [],
    };
    if (members.length > 0) {
      await deps.dispatch.execute({
        ...common,
        message: '@core.automation/task.remind.message',
        link: WORKFLOW_TASKS_PAGE_KEY,
        target: null,
        dedupKey: `${task.id}:remind:${sequence}`,
        channels: { audit: false, inApp: true, email: true, push: true },
        recipientIds: members,
      }).catch((error: unknown) => console.error(`[approval-reminder] ${task.tenantId}/${task.id}:`, error));
    }
    if (guests.length > 0 && task.target) {
      await deps.dispatch.execute({
        ...common,
        message: '@core.automation/task.remind.portal-message',
        link: '',
        target: task.target,
        audience: 'portal',
        dedupKey: `${task.id}:remind:${sequence}:portal`,
        channels: { audit: false, inApp: true, email: true, push: false },
        recipientIds: guests,
      }).catch((error: unknown) => console.error(`[approval-reminder] ${task.tenantId}/${task.id} (portal):`, error));
    }
    sent += 1;
  }
  return sent;
};
