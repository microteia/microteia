import type { WorkflowClockStatus } from '../schema/workflowClock';

export interface IWorkflowClockRepository {
  subscribeToClockStatus(
    tenantId: string,
    definitionId: string,
    onUpdate: (status: WorkflowClockStatus | null) => void,
    onError?: (error: Error) => void,
  ): () => void;
}
