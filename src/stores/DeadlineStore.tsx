import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { DeadlineStoreContext } from './useDeadlineStore';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeGetDeadlinesUseCase } from '../domain/usecases/deadlines/GetDeadlinesUseCase';
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
    get: makeGetDeadlinesUseCase(deadlineRepository),
    create: makeCreateDeadlineUseCase(deadlineRepository),
    update: makeUpdateDeadlineUseCase(deadlineRepository),
    complete: makeCompleteDeadlineUseCase(deadlineRepository),
    updateStatus: makeUpdateDeadlineStatusUseCase(deadlineRepository),
    delete: makeDeleteDeadlineUseCase(deadlineRepository),
  }), [deadlineRepository]);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      const list = await uc.get.execute(currentTenant.id);
      setDeadlines(list);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, uc.get]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- triggering async refresh on mount/tenant change is architecturally required
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.DEADLINES_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  const createDeadline = useCallback(async (data: Omit<Deadline, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, data);
    setDeadlines((prev) => [...prev, item].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()));
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
      completeDeadline, updateDeadlineStatus, deleteDeadline, refresh,
    }}>
      {children}
    </DeadlineStoreContext.Provider>
  );
};
