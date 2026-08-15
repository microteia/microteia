import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { AuditSeverity } from '../../../domain/entities/AuditLog';
import type { CreateAuditLogUseCase } from '../../../domain/usecases/CreateAuditLogUseCase';

export const makeRegisterAuditStepDefinition = (createAuditLogUseCase: CreateAuditLogUseCase): StepDefinition => ({
  id: 'register-audit',
  version: 1,
  name: '@core.automation/step.register-audit.name',
  description: '@core.automation/step.register-audit.description',
  icon: 'RiFileHistoryLine',
  category: 'Action',
  type: 'Action',
  configurable: true,
  inputs: [
    { id: 'title', label: '@core.automation/step.register-audit.label.titulo', required: true, type: 'String' },
    { id: 'message', label: '@core.automation/step.register-audit.label.mensagem', required: true, type: 'String' },
    { 
      id: 'severity', 
      label: '@core.automation/step.register-audit.label.severidade', 
      required: true, 
      type: 'String',
      options: {
        kind: 'Static',
        options: [
          { value: 'LOW', label: '@core.automation/step.register-audit.label.baixa', color: 'info' },
          { value: 'HIGH', label: '@core.automation/step.register-audit.label.alta', color: 'warning' },
          { value: 'CRITICAL', label: '@core.automation/step.register-audit.label.critica', color: 'danger' },
        ]
      },
      defaultValue: 'LOW',
    },
    { id: 'entity', label: '@core.automation/step.register-audit.label.entidade-relacionada', required: false, type: 'String', defaultValue: 'workflow' },
    { id: 'entityId', label: '@core.automation/step.register-audit.label.id-da-entidade-relacionada', required: false, type: 'String' },
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
        severity: (inputs.severity as AuditSeverity) ?? 'LOW',
        type: 'AUDIT',
        entity: inputs.entity ? String(inputs.entity) : 'workflow',
        entityId: inputs.entityId ? String(inputs.entityId) : context.execution.workflowDefinitionId,
        text: String(inputs.message),
      });
      return { success: true, message: 'Auditoria registrada' };
    },
  }),
});
