import type { WorkflowDefinition, WorkflowStep, PublicWorkflow } from '../entities/Workflow';

export interface CopyPublicWorkflowResult {
  workflowId: string;
  copiedWorkflows: number;
  copiedScripts: number;
  copiedSubWorkflows: number;
}

export interface IWorkflowDefinitionRepository {
  getWorkflowDefinitions(tenantId: string): Promise<WorkflowDefinition[]>;
  subscribeToWorkflowDefinitions(tenantId: string, onUpdate: (definitions: WorkflowDefinition[]) => void): () => void;
  subscribeToPublicWorkflowDefinitions(onUpdate: (definitions: PublicWorkflow[]) => void): () => void;
  getWorkflowDefinitionById(tenantId: string, id: string): Promise<WorkflowDefinition | null>;
  createWorkflowDefinition(
    tenantId: string,
    data: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ): Promise<WorkflowDefinition>;
  updateWorkflowDefinition(
    tenantId: string,
    id: string,
    data: Partial<Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt'>>,
  ): Promise<void>;
  updateWorkflowSteps(tenantId: string, id: string, steps: WorkflowStep[]): Promise<void>;
  deleteWorkflowDefinition(tenantId: string, id: string): Promise<void>;
  copyPublicWorkflowDefinition(
    originalWorkflowId: string,
    targetTenantId: string,
  ): Promise<CopyPublicWorkflowResult>;
}
