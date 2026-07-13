import type {
  CopyPublicWorkflowResult,
  IWorkflowDefinitionRepository,
} from '../../repositories/IWorkflowDefinitionRepository';

export type CopyPublicWorkflowUseCase = {
  execute: (
    originalWorkflowId: string,
    targetTenantId: string,
  ) => Promise<CopyPublicWorkflowResult>;
};

export const makeCopyPublicWorkflowUseCase = (
  repo: IWorkflowDefinitionRepository,
): CopyPublicWorkflowUseCase => ({
  execute: (originalWorkflowId, targetTenantId) =>
    repo.copyPublicWorkflowDefinition(originalWorkflowId, targetTenantId),
});
