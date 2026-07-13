import type { IWorkflowDefinitionRepository, UpdateFromSourceWorkflowResult } from '../../repositories/IWorkflowDefinitionRepository';

export type UpdateFromSourceWorkflowUseCase = {
  execute: (workflowId: string, targetTenantId: string) => Promise<UpdateFromSourceWorkflowResult>;
};

export const makeUpdateFromSourceWorkflowUseCase = (
  repository: IWorkflowDefinitionRepository,
): UpdateFromSourceWorkflowUseCase => ({
  execute: (workflowId, targetTenantId) => repository.updateFromSourceWorkflow(workflowId, targetTenantId),
});
