import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import type { CreateAuditLogUseCase } from '../../../domain/usecases/CreateAuditLogUseCase';

export const makeNotifyStepDefinition = (createAuditLogUseCase: CreateAuditLogUseCase): StepDefinition => ({
  id: 'notify',
  version: 1,
  name: 'Notificar',
  description: 'Gera um alerta de severidade crítica, visível no sino de notificações do escritório.',
  icon: 'RiNotification3Line',
  category: 'Notification',
  configurable: true,
  inputs: [
    { id: 'title', label: 'Título', required: true, type: 'String' },
    { id: 'message', label: 'Mensagem', required: true, type: 'String' },
    { id: 'entity', label: 'Entidade relacionada', required: false, type: 'String', defaultValue: 'workflow' },
    { id: 'entityId', label: 'Id da entidade relacionada', required: false, type: 'String' },
    { id: 'entityLink', label: 'Link da entidade relacionada', required: false, type: 'String' },
  ],
  outputDefinitions: [],
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      await createAuditLogUseCase.execute({
        tenantId: context.execution.tenantId,
        title: String(inputs.title),
        userId: 'system',
        userName: 'Automação',
        photoURL: '',
        action: 'SYSTEM',
        severity: 'CRITICAL',
        type: 'AUDIT',
        entity: inputs.entity ? String(inputs.entity) : 'workflow',
        entityId: inputs.entityId ? String(inputs.entityId) : context.execution.workflowDefinitionId,
        entityLink: inputs.entityLink ? String(inputs.entityLink) : undefined,
        text: String(inputs.message),
      });
      return { success: true, message: 'Notificação registrada' };
    },
  }),
});
