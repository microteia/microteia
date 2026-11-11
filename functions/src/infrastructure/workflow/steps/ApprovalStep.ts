import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { IWorkflowTaskRepository } from '../../../domain/repositories/IWorkflowTaskRepository';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import type { DispatchNotificationUseCase } from '../../../domain/usecases/DispatchNotificationUseCase';
import { NOTIFICATION_MAX_RECIPIENTS, notificationRecipientCandidates } from '../../../domain/schema/notifications';
import {
  APPROVAL_EXPIRED_OUTCOME,
  WORKFLOW_TASKS_PAGE_KEY,
  MAX_APPROVAL_DAYS,
  approvalOutcomesOf,
  workflowTaskId,
} from '../../../domain/schema/workflowTask';
import { eventRecordOf } from './NotifyStep';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ApprovalStepDeps {
  tasks: IWorkflowTaskRepository;
  /** Os membros com a permissão — a mesma pergunta das Security Rules, com o curinga do dono. */
  memberIdsGranting(tenantId: string, permission: string, limit: number): Promise<string[]>;
  dispatch: DispatchNotificationUseCase;
  screens: IScreenDefinitionProvider;
}

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Aprovação — a automação PARA e pede uma decisão a uma pessoa.
 *
 * O passo cria a tarefa, avisa quem decide e pede a pausa (`suspend`) com a tarefa junto. Quem retoma
 * é a decisão (`completeWorkflowTask`), que grava o desfecho como saída deste passo; ou o prazo, que
 * retoma com o desfecho de expiração que o passo já deixou nas saídas.
 *
 * Confere ANTES de criar qualquer coisa se a execução pode pausar aqui: uma aprovação num botão ou
 * dentro de um ramo criaria a tarefa e avisaria as pessoas para o executor recusar a pausa em seguida.
 */
export const makeApprovalStepDefinition = (deps: ApprovalStepDeps): StepDefinition => ({
  ...coreStepMetadata('approval'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      if (context.canSuspend !== true) {
        return { success: false, message: '@core.automation/step.approval.cannot-wait' };
      }

      const tenantId = context.execution.tenantId;
      const title = textOf(inputs.title);
      if (!title) return { success: false, message: '@core.automation/step.approval.no-title' };

      const permission = textOf(inputs.assigneePermission);
      const assigneeIds = [...new Set([
        ...notificationRecipientCandidates(inputs.assigneeMembers),
        ...notificationRecipientCandidates(inputs.assigneesFrom),
        ...(permission ? await deps.memberIdsGranting(tenantId, permission, NOTIFICATION_MAX_RECIPIENTS) : []),
      ])].slice(0, NOTIFICATION_MAX_RECIPIENTS);
      if (assigneeIds.length === 0) {
        return { success: false, message: '@core.automation/step.approval.no-assignee' };
      }

      const now = context.services.now();
      const days = Number(inputs.dueInDays);
      const dueAt = Number.isFinite(days) && days > 0
        ? new Date(now.getTime() + Math.min(days, MAX_APPROVAL_DAYS) * DAY_MS)
        : null;
      const resumeAt = dueAt ?? new Date(now.getTime() + MAX_APPROVAL_DAYS * DAY_MS);

      const outcomes = approvalOutcomesOf(inputs.outcomes);
      const declaredTimeout = textOf(inputs.onTimeout);
      const timeoutOutcome = declaredTimeout ? approvalOutcomesOf([declaredTimeout])[0].key : APPROVAL_EXPIRED_OUTCOME;

      const stepId = context.stepId ?? 'approval';
      const taskId = workflowTaskId(context.execution.id, stepId);
      const target = await eventRecordOf(deps.screens, tenantId, context.event).catch(() => null);
      const message = textOf(inputs.message);

      await deps.tasks.createIfAbsent({
        id: taskId,
        tenantId,
        workflowDefinitionId: context.execution.workflowDefinitionId,
        executionId: context.execution.id,
        stepId,
        title,
        message,
        assigneeIds,
        outcomes,
        status: 'open',
        createdAt: now,
        dueAt,
        target,
      });

      // O aviso leva à CAIXA, e não ao registro: é lá que a decisão se toma. A mesma chave faz a nova
      // tentativa do passo não repetir o e-mail.
      const notified = await deps.dispatch.execute({
        tenantId,
        source: 'workflow',
        workflowId: context.execution.workflowDefinitionId,
        executionId: context.execution.id,
        title,
        message: message || '@core.automation/task.notify.message',
        params: {},
        link: WORKFLOW_TASKS_PAGE_KEY,
        target: null,
        category: 'core.automation/task',
        dedupKey: taskId,
        channels: { audit: false, inApp: true, email: true, push: true },
        recipientIds: assigneeIds,
        recipientPermissions: [],
      }).catch((error: unknown) => {
        context.logger.warn('@core.automation/step.approval.notify-failed', {
          detail: error instanceof Error ? error.message : String(error),
        });
        return null;
      });
      for (const issue of notified?.issues ?? []) context.logger.warn(issue.message, issue.params);

      return {
        success: true,
        message: '@core.automation/step.approval.waiting',
        messageParams: { count: String(assigneeIds.length) },
        outputs: {
          outcome: timeoutOutcome,
          decidedBy: '',
          decidedByName: '',
          decidedAt: null,
          comment: '',
          taskId,
        },
        suspend: { resumeAt, taskId },
      };
    },
  }),
});
