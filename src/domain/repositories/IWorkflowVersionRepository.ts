import type { WorkflowVersion } from '../schema/workflowVersion';

export interface IWorkflowVersionRepository {
  /** As versões guardadas da automação, da mais nova para a mais antiga. */
  listVersions(tenantId: string, workflowId: string, max: number): Promise<WorkflowVersion[]>;
}
