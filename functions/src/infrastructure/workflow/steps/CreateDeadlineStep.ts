import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import type { IDeadlineRepository } from '../../../domain/repositories/IDeadlineRepository';
import type { DeadlinePriority } from '../../../domain/entities/Deadline';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const PRIORITY_COLORS: Record<DeadlinePriority, string> = {
  'Baixa': 'success',
  'Média': 'warning',
  'Alta': 'secondary',
  'Crítica': 'danger',
};

const PRIORITY_OPTIONS = (['Baixa', 'Média', 'Alta', 'Crítica'] as DeadlinePriority[])
  .map((p) => ({ value: p, label: p, color: PRIORITY_COLORS[p] }));

const parseDueDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  const raw = String(value);
  return DATE_ONLY_PATTERN.test(raw) ? new Date(`${raw}T23:59:00`) : new Date(raw);
};

export const makeCreateDeadlineStepDefinition = (deadlineRepository: IDeadlineRepository): StepDefinition => ({
  id: 'create-deadline',
  version: 1,
  name: 'Criar Prazo',
  description: 'Cria um prazo para um processo.',
  icon: 'RiCalendarEventLine',
  category: 'Action',
  configurable: true,
  inputs: [
    { id: 'caseId', label: 'Processo', required: true, type: 'EntityReference' },
    { id: 'dueDate', label: 'Data de vencimento', required: true, type: 'Date' },
    { id: 'type', label: 'Tipo de prazo', required: true, type: 'String',defaultValue: 'Petição',  options: { kind: 'Lookup', lookup: 'deadlineTypes' } },
    { id: 'priority', label: 'Prioridade', required: true, type: 'String', defaultValue: 'Média' as DeadlinePriority, options: { kind: 'Static', options: PRIORITY_OPTIONS } },
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
