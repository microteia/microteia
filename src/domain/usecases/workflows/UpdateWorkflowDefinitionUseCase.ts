import type { WorkflowDefinition } from '../../entities/Workflow';
import type { IWorkflowDefinitionRepository } from '../../repositories/IWorkflowDefinitionRepository';

export type UpdateWorkflowDefinitionUseCase = {
  execute: (
    tenantId: string,
    id: string,
    data: Partial<Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt'>>,
  ) => Promise<void>;
};

export const makeUpdateWorkflowDefinitionUseCase = (repo: IWorkflowDefinitionRepository): UpdateWorkflowDefinitionUseCase => ({
  execute: (tenantId, id, data) => repo.updateWorkflowDefinition(tenantId, id, data),
});
