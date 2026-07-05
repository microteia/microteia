import type { WorkflowDefinition, WorkflowStep } from '../entities/Workflow';

export interface IWorkflowDefinitionRepository {
  getWorkflowDefinitions(tenantId: string): Promise<WorkflowDefinition[]>;
  subscribeToWorkflowDefinitions(tenantId: string, onUpdate: (definitions: WorkflowDefinition[]) => void): () => void;
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
}
