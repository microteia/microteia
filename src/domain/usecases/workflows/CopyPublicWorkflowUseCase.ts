import type {
  CopyPublicWorkflowResult,
  IWorkflowDefinitionRepository,
} from '../../repositories/IWorkflowDefinitionRepository';

export type CopyPublicWorkflowUseCase = {
  execute: (
    originalTenantId: string,
    originalWorkflowId: string,
    targetTenantId: string,
  ) => Promise<CopyPublicWorkflowResult>;
};

export const makeCopyPublicWorkflowUseCase = (
  repo: IWorkflowDefinitionRepository,
): CopyPublicWorkflowUseCase => ({
  execute: (originalTenantId, originalWorkflowId, targetTenantId) =>
    repo.copyPublicWorkflowDefinition(originalTenantId, originalWorkflowId, targetTenantId),
});
