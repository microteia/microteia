import type { WorkflowDefinition } from '../../entities/Workflow';
import type { IWorkflowDefinitionRepository } from '../../repositories/IWorkflowDefinitionRepository';

export type CreateWorkflowDefinitionUseCase = {
  execute: (
    tenantId: string,
    data: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ) => Promise<WorkflowDefinition>;
};

export const makeCreateWorkflowDefinitionUseCase = (repo: IWorkflowDefinitionRepository): CreateWorkflowDefinitionUseCase => ({
  execute: (tenantId, data, id) => repo.createWorkflowDefinition(tenantId, data, id),
});
