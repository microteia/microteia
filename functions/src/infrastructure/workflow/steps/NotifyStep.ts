import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { DispatchNotificationUseCase } from '../../../domain/usecases/DispatchNotificationUseCase';
import type { InputMapping } from '../../../domain/entities/Workflow';
import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
import { isChannelEnabled, notificationRecipientCandidates } from '../../../domain/schema/notifications';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import type { WorkflowEvent } from '../../../domain/entities/Workflow';
import type { RecordLinkTarget } from '../../../domain/schema/recordLink';
import { parsePath, resolvePath } from '../../../domain/schema/pathResolver';
import { eventNameToRoot } from '../../../domain/schema/eventCatalog';

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

/** O id que um valor de referência carrega — o próprio texto, ou o `id` do registro hidratado. */
const recordIdOf = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && !Array.isArray(value)) return textOf((value as Record<string, unknown>).id);
  return '';
};

type PortalRecordChoice = { ok: true; target: RecordLinkTarget | null } | { ok: false };

/**
 * O registro de que o aviso ao convidado fala — e, por ele, QUEM do portal recebe. É um caminho do
 * evento, e não uma expressão livre, porque o caminho tem tipo: `caseId` leva a processos, e é a tela
 * que diz a coleção. Um id solto não diria de que tela ele é.
 *
 * Caminho que não leva a um registro é erro de configuração; o caminho certo que veio vazio nesta
 * execução não é — o aviso só não tem a quem ir.
 */
const portalRecordOf = async (
  screens: IScreenDefinitionProvider,
  tenantId: string,
  event: WorkflowEvent,
  mapping: InputMapping | undefined,
  value: unknown,
): Promise<PortalRecordChoice> => {
  if (!mapping || mapping.kind !== 'Event' || !mapping.path.trim()) return { ok: false };
  const ctx = await screens.getSchemaContext(tenantId);
  const root = eventNameToRoot(event.name, ctx);
  if (!root) return { ok: false };
  const resolution = resolvePath(ctx, root, parsePath(mapping.path));
  if (!resolution.valid || resolution.node.kind !== 'entity') return { ok: false };
  const recordId = recordIdOf(value);
  return { ok: true, target: recordId ? { collection: resolution.node.collection, recordId } : null };
};

/**
 * O passo `notify`: os inputs viram um pedido de entrega, e o resultado vira as saídas
 * `recipients`, `delivered.<canal>` e `failed.<canal>`.
 *
 * Um canal pessoal marcado sem NENHUMA origem de destinatário configurada é erro de configuração, e
 * reprova o passo. Origem configurada que não rende ninguém nesta execução — o campo veio vazio, a
 * permissão não tem membros — não é erro: o passo segue, e o log diz por quê.
 *
 * Com `portalGuests`, recebem os convidados do portal que veem o registro — e SÓ eles: o passo que
 * avisa para fora não avisa o escritório, para que o texto escrito para um lado nunca chegue ao outro.
 */
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
      const toPortal = isChannelEnabled(inputs.portalGuests);
      if (toPortal) {
        if (RECIPIENT_INPUTS.some((id) => isConfigured(configuration[id]))) {
          return { success: false, message: '@core.automation/step.notify.portal.mixed' };
        }
        if (!channels.inApp && !channels.email) {
          return { success: false, message: '@core.automation/step.notify.portal.no-channel' };
        }
      } else if (personal && !RECIPIENT_INPUTS.some((id) => isConfigured(configuration[id]))) {
        return { success: false, message: '@core.automation/step.notify.recipients.missing' };
      }

      const tenantId = context.execution.tenantId;
      // Abrir o registro do evento é o PADRÃO: o aviso de um prazo abre o prazo sem que quem escreveu
      // a automação precise montar chave de aba nenhuma. Para o portal o registro não é opcional: é
      // por ele que se sabe quem de fora recebe.
      const opensRecord = inputs.openRecord === undefined || isChannelEnabled(inputs.openRecord);
      let target: RecordLinkTarget | null = null;
      if (toPortal && isConfigured(configuration.portalRecord)) {
        const chosen = await portalRecordOf(screens, tenantId, context.event, configuration.portalRecord, inputs.portalRecord);
        if (!chosen.ok) return { success: false, message: '@core.automation/step.notify.portal.record-invalid' };
        target = chosen.target;
      } else if (toPortal || opensRecord) {
        target = await eventRecordOf(screens, tenantId, context.event).catch(() => null);
      }
      const permission = textOf(inputs.recipientPermission);

      const result = await dispatch.execute({
        tenantId,
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
        ...(toPortal ? { audience: 'portal' as const } : {}),
        recipientIds: toPortal ? [] : [
          ...notificationRecipientCandidates(inputs.recipientMembers),
          ...notificationRecipientCandidates(inputs.recipientsFrom),
        ],
        recipientPermissions: !toPortal && permission ? [permission] : [],
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
