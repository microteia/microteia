import type { WorkflowExecution } from '../entities/Workflow';

export interface IWorkflowExecutionRepository {
  subscribeToWorkflowExecutions(
    tenantId: string,
    workflowDefinitionId: string,
    onUpdate: (executions: WorkflowExecution[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
}
