import type { PublicWorkflow } from '../../entities/Workflow';
import type { IWorkflowDefinitionRepository } from '../../repositories/IWorkflowDefinitionRepository';

export type SubscribeToPublicWorkflowDefinitionsUseCase = {
  execute: (onUpdate: (definitions: PublicWorkflow[]) => void) => () => void;
};

export const makeSubscribeToPublicWorkflowDefinitionsUseCase = (
  repo: IWorkflowDefinitionRepository,
): SubscribeToPublicWorkflowDefinitionsUseCase => ({
  execute: (onUpdate) => repo.subscribeToPublicWorkflowDefinitions(onUpdate),
});
