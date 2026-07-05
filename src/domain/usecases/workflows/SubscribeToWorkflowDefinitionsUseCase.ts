import type { WorkflowDefinition } from '../../entities/Workflow';
import type { IWorkflowDefinitionRepository } from '../../repositories/IWorkflowDefinitionRepository';

export type SubscribeToWorkflowDefinitionsUseCase = {
  execute: (tenantId: string, onUpdate: (definitions: WorkflowDefinition[]) => void) => () => void;
};

export const makeSubscribeToWorkflowDefinitionsUseCase = (
  repo: IWorkflowDefinitionRepository,
): SubscribeToWorkflowDefinitionsUseCase => ({
  execute: (tenantId, onUpdate) => repo.subscribeToWorkflowDefinitions(tenantId, onUpdate),
});
