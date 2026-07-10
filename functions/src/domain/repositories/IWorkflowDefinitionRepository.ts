import type { WorkflowDefinition } from '../entities/Workflow';

export interface IWorkflowDefinitionRepository {
  findEnabledByEvent(tenantId: string, eventName: string): Promise<WorkflowDefinition[]>;
  findById(tenantId: string, id: string): Promise<WorkflowDefinition | null>;
}
