import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { DispatchNotificationUseCase } from '../../../domain/usecases/DispatchNotificationUseCase';
import type { InputMapping } from '../../../domain/entities/Workflow';
import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
import { isChannelEnabled, notificationRecipientCandidates } from '../../../domain/schema/notifications';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import type { WorkflowEvent } from '../../../domain/entities/Workflow';
import type { RecordLinkTarget } from '../../../domain/schema/recordLink';

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
/**
 * O registro que disparou a automação — o prazo que venceu, a nota que mudou. O evento de registro
 * é `<prefixo>.<o que houve>` com o registro inteiro no payload; o prefixo diz a tela, e a tela diz
 * a coleção. Evento que não é de registro (manual, agendado) não tem alvo, e o aviso só não abre nada.
 */
const eventRecordOf = async (
  screens: IScreenDefinitionProvider,
  tenantId: string,
  event: WorkflowEvent,
): Promise<RecordLinkTarget | null> => {
  const recordId = typeof event.payload?.id === 'string' ? event.payload.id : '';
  const dot = event.name.lastIndexOf('.');
  if (!recordId || dot <= 0) return null;
  const prefix = event.name.slice(0, dot);
  const screen = (await screens.getScreens(tenantId))
    .find((one) => (one.eventPrefix ?? one.collection ?? one.id) === prefix);
  return screen ? { collection: screen.collection ?? screen.id, recordId } : null;
};

export const makeNotifyStepDefinition = (
  dispatch: DispatchNotificationUseCase,
  screens: IScreenDefinitionProvider,
): StepDefinition => ({
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

      // Abrir o registro do evento é o PADRÃO: o aviso de um prazo abre o prazo sem que quem escreveu
      // a automação precise montar chave de aba nenhuma.
      const opensRecord = inputs.openRecord === undefined || isChannelEnabled(inputs.openRecord);
      const target = opensRecord
        ? await eventRecordOf(screens, context.execution.tenantId, context.event).catch(() => null)
        : null;
      const permission = textOf(inputs.recipientPermission);

      const result = await dispatch.execute({
        tenantId: context.execution.tenantId,
        source: 'workflow',
        workflowId: context.execution.workflowDefinitionId,
        executionId: context.execution.id,
        title: textOf(inputs.title),
        message: textOf(inputs.message),
        params: paramsOf(inputs.messageParams),
        link: textOf(inputs.link),
        target,
        category: textOf(inputs.category),
        channels,
        recipientIds: [
          ...notificationRecipientCandidates(inputs.recipientMembers),
          ...notificationRecipientCandidates(inputs.recipientsFrom),
        ],
        recipientPermissions: permission ? [permission] : [],
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
