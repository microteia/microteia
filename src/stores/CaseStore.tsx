import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { CaseStoreContext } from './useCaseStore';
import { useTenant } from './useTenant';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeGetCasesUseCase } from '../domain/usecases/cases/GetCasesUseCase';
import { makeCreateCaseUseCase } from '../domain/usecases/cases/CreateCaseUseCase';
import { makeUpdateCaseUseCase, makeUpdateCaseStatusUseCase } from '../domain/usecases/cases/UpdateCaseUseCase';
import { makeDeleteCaseUseCase } from '../domain/usecases/cases/DeleteCaseUseCase';
import type { Case, CaseStatus } from '../domain/entities';

export const CaseStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { caseRepository } = useDI();

  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    get: makeGetCasesUseCase(caseRepository),
    create: makeCreateCaseUseCase(caseRepository),
    update: makeUpdateCaseUseCase(caseRepository),
    updateStatus: makeUpdateCaseStatusUseCase(caseRepository),
    delete: makeDeleteCaseUseCase(caseRepository),
  }), [caseRepository]);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      const list = await uc.get.execute(currentTenant.id);
      setCases(list);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, uc.get]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- triggering async refresh on mount/tenant change is architecturally required
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.CASES_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  const createCase = useCallback(async (data: Omit<Case, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, data);
    setCases((prev) => [item, ...prev]);
    storeEvents.emit(StoreEvents.CASES_UPDATED);
    return item;
  }, [currentTenant, uc.create]);

  const updateCase = useCallback(async (caseId: string, data: Partial<Omit<Case, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => {
    if (!currentTenant) return;
    await uc.update.execute(currentTenant.id, caseId, data);
    setCases((prev) => prev.map((c) => c.id === caseId ? { ...c, ...data } : c));
    storeEvents.emit(StoreEvents.CASES_UPDATED);
  }, [currentTenant, uc.update]);

  const updateCaseStatus = useCallback(async (caseId: string, status: CaseStatus) => {
    if (!currentTenant) return;
    await uc.updateStatus.execute(currentTenant.id, caseId, status);
    setCases((prev) => prev.map((c) => c.id === caseId ? { ...c, status } : c));
    storeEvents.emit(StoreEvents.CASES_UPDATED);
  }, [currentTenant, uc.updateStatus]);

  const deleteCase = useCallback(async (caseId: string) => {
    if (!currentTenant) return;
    await uc.delete.execute(currentTenant.id, caseId);
    setCases((prev) => prev.filter((c) => c.id !== caseId));
    storeEvents.emit(StoreEvents.CASES_UPDATED);
    storeEvents.emit(StoreEvents.DEADLINES_UPDATED);
  }, [currentTenant, uc.delete]);

  return (
    <CaseStoreContext.Provider value={{ cases, isLoading, createCase, updateCase, updateCaseStatus, deleteCase, refresh }}>
      {children}
    </CaseStoreContext.Provider>
  );
};
