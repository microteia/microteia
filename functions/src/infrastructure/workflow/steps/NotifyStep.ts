import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { CreateAuditLogUseCase } from '../../../domain/usecases/CreateAuditLogUseCase';

import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
export const makeNotifyStepDefinition = (createAuditLogUseCase: CreateAuditLogUseCase): StepDefinition => ({
  ...coreStepMetadata('notify'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
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
