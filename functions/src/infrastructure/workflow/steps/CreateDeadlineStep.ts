import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import type { IDeadlineRepository } from '../../../domain/repositories/IDeadlineRepository';
import type { DeadlinePriority } from '../../../domain/entities/Deadline';

export const makeCreateDeadlineStepDefinition = (deadlineRepository: IDeadlineRepository): StepDefinition => ({
  id: 'create-deadline',
  version: 1,
  name: 'Criar Prazo',
  description: 'Cria um novo prazo vinculado a um processo.',
  icon: 'RiCalendarEventLine',
  category: 'Action',
  configurable: true,
  inputs: [
    { id: 'caseId', label: 'Processo', required: true, type: 'EntityReference' },
    { id: 'caseNumber', label: 'Número do processo', required: true, type: 'String' },
    { id: 'caseTitle', label: 'Título do processo', required: true, type: 'String' },
    { id: 'personName', label: 'Nome do cliente', required: true, type: 'String' },
    { id: 'dueDate', label: 'Data de vencimento', required: true, type: 'Date' },
    { id: 'type', label: 'Tipo de prazo', required: true, type: 'String' },
    { id: 'priority', label: 'Prioridade', required: false, type: 'String', defaultValue: 'Média' as DeadlinePriority },
    { id: 'description', label: 'Descrição', required: false, type: 'String' },
    { id: 'responsibleLawyerId', label: 'Advogado responsável', required: false, type: 'EntityReference' },
    { id: 'responsibleLawyerName', label: 'Nome do advogado responsável', required: false, type: 'String' },
  ],
  outputDefinitions: [
    { id: 'deadlineId', label: 'Id do prazo criado', type: 'String' },
  ],
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      const deadlineId = await deadlineRepository.createDeadline(context.execution.tenantId, {
        caseId: String(inputs.caseId),
        caseNumber: String(inputs.caseNumber),
        caseTitle: String(inputs.caseTitle),
        personName: String(inputs.personName),
        description: inputs.description ? String(inputs.description) : null,
        dueDate: inputs.dueDate instanceof Date ? inputs.dueDate : new Date(String(inputs.dueDate)),
        type: String(inputs.type),
        priority: (inputs.priority as DeadlinePriority) ?? 'Média',
        responsibleLawyerId: inputs.responsibleLawyerId ? String(inputs.responsibleLawyerId) : null,
        responsibleLawyerName: inputs.responsibleLawyerName ? String(inputs.responsibleLawyerName) : null,
        createdBy: 'workflow-engine',
      });
      return { success: true, message: `Prazo "${String(inputs.type)}" criado`, outputs: { deadlineId } };
    },
  }),
});
