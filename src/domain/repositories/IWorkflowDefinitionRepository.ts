import type { WorkflowDefinition, WorkflowStep } from '../entities/Workflow';
import type { WorkflowContentOrigin } from '../schema/workflowVersion';

export interface IWorkflowDefinitionRepository {
  getWorkflowDefinitions(tenantId: string): Promise<WorkflowDefinition[]>;
  subscribeToWorkflowDefinitions(tenantId: string, onUpdate: (definitions: WorkflowDefinition[]) => void): () => void;
  getWorkflowDefinitionById(tenantId: string, id: string): Promise<WorkflowDefinition | null>;
  /** `id` presente = identificador escolhido por quem cria; ausente = gerado pelo banco. */
  createWorkflowDefinition(
    tenantId: string,
    data: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ): Promise<WorkflowDefinition>;
  updateWorkflowDefinition(
    tenantId: string,
    id: string,
    data: Partial<Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt'>>,
  ): Promise<void>;
  /** `origin` ausente é EDIÇÃO; a instalação de extensão diz que é ela (ver `WorkflowContentOrigin`). */
  updateWorkflowSteps(tenantId: string, id: string, steps: WorkflowStep[], origin?: WorkflowContentOrigin): Promise<void>;
  deleteWorkflowDefinition(tenantId: string, id: string): Promise<void>;
}
