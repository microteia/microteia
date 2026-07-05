import type { IWorkflowDefinitionRepository } from '../../repositories/IWorkflowDefinitionRepository';

export type DeleteWorkflowDefinitionUseCase = {
  execute: (tenantId: string, id: string) => Promise<void>;
};

export const makeDeleteWorkflowDefinitionUseCase = (repo: IWorkflowDefinitionRepository): DeleteWorkflowDefinitionUseCase => ({
  execute: (tenantId, id) => repo.deleteWorkflowDefinition(tenantId, id),
});
