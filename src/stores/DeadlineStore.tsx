import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { DeadlineStoreContext } from './useDeadlineStore';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeSubscribeToDeadlinesUseCase } from '../domain/usecases/deadlines/SubscribeToDeadlinesUseCase';
import { makeCreateDeadlineUseCase } from '../domain/usecases/deadlines/CreateDeadlineUseCase';
import {
  makeUpdateDeadlineUseCase,
  makeCompleteDeadlineUseCase,
  makeUpdateDeadlineStatusUseCase,
} from '../domain/usecases/deadlines/UpdateDeadlineUseCase';
import { makeDeleteDeadlineUseCase } from '../domain/usecases/deadlines/DeleteDeadlineUseCase';
import type { Deadline, DeadlineStatus, DeletionActor } from '../domain/entities';

export const DeadlineStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const { deadlineRepository } = useDI();

  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    subscribe: makeSubscribeToDeadlinesUseCase(deadlineRepository),
    create: makeCreateDeadlineUseCase(deadlineRepository),
    update: makeUpdateDeadlineUseCase(deadlineRepository),
    complete: makeCompleteDeadlineUseCase(deadlineRepository),
    updateStatus: makeUpdateDeadlineStatusUseCase(deadlineRepository),
    delete: makeDeleteDeadlineUseCase(deadlineRepository),
  }), [deadlineRepository]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setDeadlines([]);
      return;
    }
    setIsLoading(true);
    const unsubscribe = uc.subscribe.execute(currentTenant.id, (list) => {
      setDeadlines(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [currentTenant, uc.subscribe]);

  const createDeadline = useCallback(async (data: Omit<Deadline, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, data);
    storeEvents.emit(StoreEvents.DEADLINES_UPDATED);
    return item;
  }, [currentTenant, uc.create]);

  const updateDeadline = useCallback(async (deadlineId: string, data: Partial<Omit<Deadline, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => {
    if (!currentTenant) return;
    await uc.update.execute(currentTenant.id, deadlineId, data);
    setDeadlines((prev) => prev.map((d) => d.id === deadlineId ? { ...d, ...data } : d));
    storeEvents.emit(StoreEvents.DEADLINES_UPDATED);
  }, [currentTenant, uc.update]);

  const completeDeadline = useCallback(async (deadlineId: string, completedBy: string) => {
    if (!currentTenant) return;
    await uc.complete.execute(currentTenant.id, deadlineId, completedBy);
    setDeadlines((prev) => prev.map((d) => d.id === deadlineId ? { ...d, status: 'Concluído' as DeadlineStatus } : d));
    storeEvents.emit(StoreEvents.DEADLINES_UPDATED);
  }, [currentTenant, uc.complete]);

  const updateDeadlineStatus = useCallback(async (deadlineId: string, status: DeadlineStatus) => {
    if (!currentTenant) return;
    await uc.updateStatus.execute(currentTenant.id, deadlineId, status);
    setDeadlines((prev) => prev.map((d) => d.id === deadlineId ? { ...d, status } : d));
    storeEvents.emit(StoreEvents.DEADLINES_UPDATED);
  }, [currentTenant, uc.updateStatus]);

  const deleteDeadline = useCallback(async (deadlineId: string) => {
    if (!currentTenant) return;
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.delete.execute(currentTenant.id, deadlineId, actor);
    setDeadlines((prev) => prev.filter((d) => d.id !== deadlineId));
    storeEvents.emit(StoreEvents.DEADLINES_UPDATED);
  }, [currentTenant, uc.delete, user, effectiveName]);

  return (
    <DeadlineStoreContext.Provider value={{
      deadlines, isLoading, createDeadline, updateDeadline,
      completeDeadline, updateDeadlineStatus, deleteDeadline,
    }}>
      {children}
    </DeadlineStoreContext.Provider>
  );
};
