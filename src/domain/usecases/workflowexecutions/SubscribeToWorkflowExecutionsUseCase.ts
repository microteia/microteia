import type { WorkflowExecution } from '../../entities/Workflow';
import type { IWorkflowExecutionRepository } from '../../repositories/IWorkflowExecutionRepository';

export type SubscribeToWorkflowExecutionsUseCase = {
  execute: (
    tenantId: string,
    workflowDefinitionId: string,
    onUpdate: (executions: WorkflowExecution[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
};

export const makeSubscribeToWorkflowExecutionsUseCase = (
  repo: IWorkflowExecutionRepository,
): SubscribeToWorkflowExecutionsUseCase => ({
  execute: (tenantId, workflowDefinitionId, onUpdate, onError) =>
    repo.subscribeToWorkflowExecutions(tenantId, workflowDefinitionId, onUpdate, onError),
});
