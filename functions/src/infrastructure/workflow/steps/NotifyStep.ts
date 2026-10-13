import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { DispatchNotificationUseCase } from '../../../domain/usecases/DispatchNotificationUseCase';
import type { InputMapping } from '../../../domain/entities/Workflow';
import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
import { isChannelEnabled, notificationRecipientCandidates } from '../../../domain/schema/notifications';

const RECIPIENT_INPUTS = ['recipientMembers', 'recipientsFrom', 'recipientPermission'] as const;

const textOf = (value: unknown): string => (value === undefined || value === null ? '' : String(value).trim());

const paramsOf = (value: unknown): Record<string, string> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined && item !== null)
      .map(([key, item]) => [key, typeof item === 'object' ? JSON.stringify(item) : String(item)]),
  );
};

const isConfigured = (mapping: InputMapping | undefined): boolean => {
  if (!mapping) return false;
  if (mapping.kind !== 'Literal') return true;
  const value = mapping.value;
  return Array.isArray(value) ? value.length > 0 : textOf(value) !== '';
};

/**
 * O passo `notify`: os inputs viram um pedido de entrega, e o resultado vira as saídas
 * `recipients`, `delivered.<canal>` e `failed.<canal>`.
 *
 * Um canal pessoal marcado sem NENHUMA origem de destinatário configurada é erro de configuração, e
 * reprova o passo. Origem configurada que não rende ninguém nesta execução — o campo veio vazio, a
 * permissão não tem membros — não é erro: o passo segue, e o log diz por quê.
 */
export const makeNotifyStepDefinition = (dispatch: DispatchNotificationUseCase): StepDefinition => ({
  ...coreStepMetadata('notify'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const channels = {
        audit: isChannelEnabled(inputs.toAudit),
        inApp: isChannelEnabled(inputs.toInApp),
        email: isChannelEnabled(inputs.toEmail),
        push: isChannelEnabled(inputs.toPush),
      };

      const personal = channels.inApp || channels.email || channels.push;
      const configuration = context.stepConfiguration ?? {};
      if (personal && !RECIPIENT_INPUTS.some((id) => isConfigured(configuration[id]))) {
        return { success: false, message: '@core.automation/step.notify.recipients.missing' };
      }

      const result = await dispatch.execute({
        tenantId: context.execution.tenantId,
        workflowId: context.execution.workflowDefinitionId,
        executionId: context.execution.id,
        title: textOf(inputs.title),
        message: textOf(inputs.message),
        params: paramsOf(inputs.messageParams),
        link: textOf(inputs.link),
        channels,
        recipientIds: [
          ...notificationRecipientCandidates(inputs.recipientMembers),
          ...notificationRecipientCandidates(inputs.recipientsFrom),
        ],
        recipientPermission: textOf(inputs.recipientPermission),
      });

      for (const issue of result.issues) context.logger.warn(issue.message, issue.params);

      return {
        success: true,
        message: '@core.automation/step.notify.done',
        outputs: {
          recipients: result.recipients,
          delivered: result.delivered,
          failed: result.failed,
        },
      };
    },
  }),
});
