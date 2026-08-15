import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import type { CreateAuditLogUseCase } from '../../../domain/usecases/CreateAuditLogUseCase';

export const makeNotifyStepDefinition = (createAuditLogUseCase: CreateAuditLogUseCase): StepDefinition => ({
  id: 'notify',
  version: 1,
  name: '@core.automation/step.notify.name',
  description: '@core.automation/step.notify.description',
  icon: 'RiNotification3Line',
  category: 'Notification',
  type: 'Action',
  configurable: true,
  inputs: [
    { id: 'title', label: '@core.automation/step.notify.label.titulo', required: true, type: 'String' },
    { id: 'message', label: '@core.automation/step.notify.label.mensagem', required: true, type: 'String' },    
  ],
  outputDefinitions: [],
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      await createAuditLogUseCase.execute({
        tenantId: context.execution.tenantId,
        title: String(inputs.title),
        userId: 'system',
        userName: '@core.automation/run.actor',
        photoURL: '',
        action: 'SYSTEM',
        severity: 'CRITICAL',
        type: 'AUDIT',
        entity: 'workflow',
        entityId: context.execution.workflowDefinitionId,
        entityLink: undefined,
        text: String(inputs.message),
      });
      return { success: true, message: '@core.automation/step.notify.done' };
    },
  }),
});
