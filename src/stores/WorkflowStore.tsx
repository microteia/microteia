import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { WorkflowStoreContext } from './useWorkflowStore';
import { useTenant } from './useTenant';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeSubscribeToWorkflowDefinitionsUseCase } from '../domain/usecases/workflows/SubscribeToWorkflowDefinitionsUseCase';
import { makeCreateWorkflowDefinitionUseCase } from '../domain/usecases/workflows/CreateWorkflowDefinitionUseCase';
import { makeUpdateWorkflowDefinitionUseCase } from '../domain/usecases/workflows/UpdateWorkflowDefinitionUseCase';
import { makeUpdateWorkflowStepsUseCase } from '../domain/usecases/workflows/UpdateWorkflowStepsUseCase';
import { makeDeleteWorkflowDefinitionUseCase } from '../domain/usecases/workflows/DeleteWorkflowDefinitionUseCase';
import type { WorkflowDefinition, WorkflowStep } from '../domain/entities/Workflow';

export const WorkflowStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { workflowDefinitionRepository } = useDI();

  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    subscribe: makeSubscribeToWorkflowDefinitionsUseCase(workflowDefinitionRepository),
    create: makeCreateWorkflowDefinitionUseCase(workflowDefinitionRepository),
    update: makeUpdateWorkflowDefinitionUseCase(workflowDefinitionRepository),
    updateSteps: makeUpdateWorkflowStepsUseCase(workflowDefinitionRepository),
    delete: makeDeleteWorkflowDefinitionUseCase(workflowDefinitionRepository),
  }), [workflowDefinitionRepository]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setWorkflows([]);
      return;
    }
    setIsLoading(true);
    const unsubscribe = uc.subscribe.execute(currentTenant.id, (list) => {
      setWorkflows(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [currentTenant, uc.subscribe]);

  const createWorkflow = useCallback(async (data: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, data);
    setWorkflows((prev) => [...prev, item]);
    storeEvents.emit(StoreEvents.WORKFLOWS_UPDATED);
    return item;
  }, [currentTenant, uc.create]);

  const updateWorkflow = useCallback(async (id: string, data: Partial<Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt'>>) => {
    if (!currentTenant) return;
    await uc.update.execute(currentTenant.id, id, data);
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, ...data } : w)));
    storeEvents.emit(StoreEvents.WORKFLOWS_UPDATED);
  }, [currentTenant, uc.update]);

  const updateWorkflowSteps = useCallback(async (id: string, steps: WorkflowStep[]) => {
    if (!currentTenant) return;
    await uc.updateSteps.execute(currentTenant.id, id, steps);
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, steps } : w)));
    storeEvents.emit(StoreEvents.WORKFLOWS_UPDATED);
  }, [currentTenant, uc.updateSteps]);

  const deleteWorkflow = useCallback(async (id: string) => {
    if (!currentTenant) return;
    await uc.delete.execute(currentTenant.id, id);
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    storeEvents.emit(StoreEvents.WORKFLOWS_UPDATED);
  }, [currentTenant, uc.delete]);

  return (
    <WorkflowStoreContext.Provider value={{
      workflows, isLoading, createWorkflow, updateWorkflow, updateWorkflowSteps, deleteWorkflow,
    }}>
      {children}
    </WorkflowStoreContext.Provider>
  );
};
