import { createContext, useContext } from 'react';
import type { WorkflowDefinition, WorkflowStep } from '../domain/entities/Workflow';

export interface WorkflowStoreContextValue {
  workflows: WorkflowDefinition[];
  isLoading: boolean;
  createWorkflow: (data: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<WorkflowDefinition>;
  updateWorkflow: (id: string, data: Partial<Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt'>>) => Promise<void>;
  updateWorkflowSteps: (id: string, steps: WorkflowStep[]) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
}

export const WorkflowStoreContext = createContext<WorkflowStoreContextValue | null>(null);

export const useWorkflowStore = (): WorkflowStoreContextValue => {
  const ctx = useContext(WorkflowStoreContext);
  if (!ctx) throw new Error('useWorkflowStore must be used within WorkflowStoreProvider');
  return ctx;
};
