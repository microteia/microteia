import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { CaseStoreContext } from './useCaseStore';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeSubscribeToCasesUseCase } from '../domain/usecases/cases/SubscribeToCasesUseCase';
import { makeCreateCaseUseCase } from '../domain/usecases/cases/CreateCaseUseCase';
import { makeUpdateCaseUseCase, makeUpdateCaseStatusUseCase } from '../domain/usecases/cases/UpdateCaseUseCase';
import { makeDeleteCaseUseCase } from '../domain/usecases/cases/DeleteCaseUseCase';
import type { Case, CaseStatus, DeletionActor } from '../domain/entities';

export const CaseStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const { caseRepository } = useDI();

  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    subscribe: makeSubscribeToCasesUseCase(caseRepository),
    create: makeCreateCaseUseCase(caseRepository),
    update: makeUpdateCaseUseCase(caseRepository),
    updateStatus: makeUpdateCaseStatusUseCase(caseRepository),
    delete: makeDeleteCaseUseCase(caseRepository),
  }), [caseRepository]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setCases([]);
      return;
    }
    setIsLoading(true);
    const unsubscribe = uc.subscribe.execute(currentTenant.id, (list) => {
      setCases(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [currentTenant, uc.subscribe]);

  const createCase = useCallback(async (data: Omit<Case, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, data);
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
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.delete.execute(currentTenant.id, caseId, actor);
    setCases((prev) => prev.filter((c) => c.id !== caseId));
    storeEvents.emit(StoreEvents.CASES_UPDATED);
    storeEvents.emit(StoreEvents.DEADLINES_UPDATED);
    storeEvents.emit(StoreEvents.FINANCIALS_UPDATED);
  }, [currentTenant, uc.delete, user, effectiveName]);

  return (
    <CaseStoreContext.Provider value={{ cases, isLoading, createCase, updateCase, updateCaseStatus, deleteCase }}>
      {children}
    </CaseStoreContext.Provider>
  );
};
