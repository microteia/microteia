import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import { AuditSeverity } from '../../../domain/entities/AuditLog';
import type { CreateAuditLogUseCase } from '../../../domain/usecases/CreateAuditLogUseCase';

import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
export const makeRegisterAuditStepDefinition = (createAuditLogUseCase: CreateAuditLogUseCase): StepDefinition => ({
  ...coreStepMetadata('register-audit'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      await createAuditLogUseCase.execute({
        tenantId: context.execution.tenantId,
        title: String(inputs.title),
        userId: 'system',
        userName: '@core.automation/run.actor',
        photoURL: '',
        action: 'SYSTEM',
        severity: (inputs.severity as AuditSeverity) ?? 'LOW',
        type: 'AUDIT',
        entity: inputs.entity ? String(inputs.entity) : 'workflow',
        entityId: inputs.entityId ? String(inputs.entityId) : context.execution.workflowDefinitionId,
        text: String(inputs.message),
      });
      return { success: true, message: '@core.automation/step.register-audit.done' };
    },
  }),
});
