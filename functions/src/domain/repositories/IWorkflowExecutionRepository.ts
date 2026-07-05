import type { WorkflowExecution } from '../entities/Workflow';

export interface IWorkflowExecutionRepository {
  create(execution: WorkflowExecution): Promise<void>;
}
