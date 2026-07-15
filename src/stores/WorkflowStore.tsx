import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { WorkflowStoreContext } from './useWorkflowStore';
import { useTenant } from './useTenant';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeSubscribeToWorkflowDefinitionsUseCase } from '../domain/usecases/workflows/SubscribeToWorkflowDefinitionsUseCase';
import { makeSubscribeToPublicWorkflowDefinitionsUseCase } from '../domain/usecases/workflows/SubscribeToPublicWorkflowDefinitionsUseCase';
import { makeCreateWorkflowDefinitionUseCase } from '../domain/usecases/workflows/CreateWorkflowDefinitionUseCase';
import { makeUpdateWorkflowDefinitionUseCase } from '../domain/usecases/workflows/UpdateWorkflowDefinitionUseCase';
import { makeUpdateWorkflowStepsUseCase } from '../domain/usecases/workflows/UpdateWorkflowStepsUseCase';
import { makeDeleteWorkflowDefinitionUseCase } from '../domain/usecases/workflows/DeleteWorkflowDefinitionUseCase';
import { makeCopyPublicWorkflowUseCase } from '../domain/usecases/workflows/CopyPublicWorkflowUseCase';
import { makeUpdateFromSourceWorkflowUseCase } from '../domain/usecases/workflows/UpdateFromSourceWorkflowUseCase';
import type { WorkflowDefinition, WorkflowStep, PublicWorkflow } from '../domain/entities/Workflow';

export const WorkflowStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { workflowDefinitionRepository } = useDI();

  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [publicWorkflows, setPublicWorkflows] = useState<PublicWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    subscribe: makeSubscribeToWorkflowDefinitionsUseCase(workflowDefinitionRepository),
    subscribePublic: makeSubscribeToPublicWorkflowDefinitionsUseCase(workflowDefinitionRepository),
    create: makeCreateWorkflowDefinitionUseCase(workflowDefinitionRepository),
    update: makeUpdateWorkflowDefinitionUseCase(workflowDefinitionRepository),
    updateSteps: makeUpdateWorkflowStepsUseCase(workflowDefinitionRepository),
    delete: makeDeleteWorkflowDefinitionUseCase(workflowDefinitionRepository),
    copyPublic: makeCopyPublicWorkflowUseCase(workflowDefinitionRepository),
    updateFromSource: makeUpdateFromSourceWorkflowUseCase(workflowDefinitionRepository),
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

  useEffect(() => {
    const unsubscribe = uc.subscribePublic.execute((list) => {
      setPublicWorkflows(list);
    });
    return () => unsubscribe();
  }, [uc.subscribePublic]);

  const createWorkflow = useCallback(async (data: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, data);
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

  const copyPublicWorkflow = useCallback(async (workflowId: string) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const result = await uc.copyPublic.execute(workflowId, currentTenant.id);
    storeEvents.emit(StoreEvents.WORKFLOWS_UPDATED);
    return result;
  }, [currentTenant, uc.copyPublic]);

  const updateFromSourceWorkflow = useCallback(async (workflowId: string) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const result = await uc.updateFromSource.execute(workflowId, currentTenant.id);
    storeEvents.emit(StoreEvents.WORKFLOWS_UPDATED);
    return result;
  }, [currentTenant, uc.updateFromSource]);

  return (
    <WorkflowStoreContext.Provider value={{
      workflows, publicWorkflows, isLoading, createWorkflow, updateWorkflow, updateWorkflowSteps, deleteWorkflow, copyPublicWorkflow, updateFromSourceWorkflow,
    }}>
      {children}
    </WorkflowStoreContext.Provider>
  );
};
