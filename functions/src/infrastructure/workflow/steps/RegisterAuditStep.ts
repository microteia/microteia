import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { AuditSeverity } from '../../../domain/entities/AuditLog';
import type { CreateAuditLogUseCase } from '../../../domain/usecases/CreateAuditLogUseCase';

export const makeRegisterAuditStepDefinition = (createAuditLogUseCase: CreateAuditLogUseCase): StepDefinition => ({
  id: 'register-audit',
  version: 1,
  name: 'Registrar Auditoria',
  description: 'Grava uma entrada no histórico de auditoria do escritório, sem gerar alerta.',
  icon: 'RiFileHistoryLine',
  category: 'Action',
  type: 'Action',
  configurable: true,
  inputs: [
    { id: 'title', label: 'Título', required: true, type: 'String' },
    { id: 'message', label: 'Mensagem', required: true, type: 'String' },
    { 
      id: 'severity', 
      label: 'Severidade', 
      required: true, 
      type: 'String',
      options: {
        kind: 'Static',
        options: [
          { value: 'LOW', label: 'Baixa', color: 'info' },
          { value: 'HIGH', label: 'Alta', color: 'warning' },
          { value: 'CRITICAL', label: 'Crítica', color: 'danger' },
        ]
      },
      defaultValue: 'LOW',
    },
    { id: 'entity', label: 'Entidade relacionada', required: false, type: 'String', defaultValue: 'workflow' },
    { id: 'entityId', label: 'Id da entidade relacionada', required: false, type: 'String' },
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
