import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import type { IDeadlineRepository } from '../../../domain/repositories/IDeadlineRepository';
import type { DeadlinePriority } from '../../../domain/entities/Deadline';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDueDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  const raw = String(value);
  return DATE_ONLY_PATTERN.test(raw) ? new Date(`${raw}T23:59:00`) : new Date(raw);
};

export const makeCreateDeadlineStepDefinition = (deadlineRepository: IDeadlineRepository): StepDefinition => ({
  id: 'create-deadline',
  version: 1,
  name: 'Criar Prazo',
  description: 'Cria um novo prazo para um processo.',
  icon: 'RiCalendarEventLine',
  category: 'Action',
  configurable: true,
  inputs: [
    { id: 'caseId', label: 'Processo', required: true, type: 'EntityReference' },
    { id: 'dueDate', label: 'Data de vencimento', required: true, type: 'Date' },
    { id: 'type', label: 'Tipo de prazo', required: true, type: 'String' },
    { id: 'priority', label: 'Prioridade', required: false, type: 'String', defaultValue: 'Média' as DeadlinePriority },
    { id: 'description', label: 'Descrição', required: false, type: 'String' },
    { id: 'responsibleLawyerId', label: 'Advogado responsável', required: false, type: 'EntityReference' },
  ],
  outputDefinitions: [
    { id: 'deadlineId', label: 'Id do prazo criado', type: 'String' },
  ],
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      const deadlineId = await deadlineRepository.createDeadline(context.execution.tenantId, {
        caseId: String(inputs.caseId),
        description: inputs.description ? String(inputs.description) : null,
        dueDate: parseDueDate(inputs.dueDate),
        type: String(inputs.type),
        priority: (inputs.priority as DeadlinePriority) ?? 'Média',
        responsibleLawyerId: inputs.responsibleLawyerId ? String(inputs.responsibleLawyerId) : null,
        createdBy: 'workflow-engine',
      });
      return { success: true, message: `Prazo "${String(inputs.type)}" criado`, outputs: { deadlineId } };
    },
  }),
});
