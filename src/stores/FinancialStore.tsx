import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { FinancialStoreContext } from './useFinancialStore';
import { useTenant } from './useTenant';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeGetFinancialsUseCase } from '../domain/usecases/financials/GetFinancialsUseCase';
import { makeCreateFinancialUseCase } from '../domain/usecases/financials/CreateFinancialUseCase';
import {
  makeUpdateFinancialUseCase,
  makeMarkFinancialPaidUseCase,
  makeUpdateFinancialStatusUseCase,
} from '../domain/usecases/financials/UpdateFinancialUseCase';
import { makeDeleteFinancialUseCase } from '../domain/usecases/financials/DeleteFinancialUseCase';
import type { Financial, FinancialStatus } from '../domain/entities';

export const FinancialStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { financialRepository } = useDI();

  const [financials, setFinancials] = useState<Financial[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    get: makeGetFinancialsUseCase(financialRepository),
    create: makeCreateFinancialUseCase(financialRepository),
    update: makeUpdateFinancialUseCase(financialRepository),
    markPaid: makeMarkFinancialPaidUseCase(financialRepository),
    updateStatus: makeUpdateFinancialStatusUseCase(financialRepository),
    delete: makeDeleteFinancialUseCase(financialRepository),
  }), [financialRepository]);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      const list = await uc.get.execute(currentTenant.id);
      setFinancials(list);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, uc.get]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- triggering async refresh on mount/tenant change is architecturally required
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.FINANCIALS_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  const createFinancial = useCallback(async (data: Omit<Financial, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, data);
    setFinancials((prev) => [item, ...prev]);
    storeEvents.emit(StoreEvents.FINANCIALS_UPDATED);
    return item;
  }, [currentTenant, uc.create]);

  const updateFinancial = useCallback(async (financialId: string, data: Partial<Omit<Financial, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => {
    if (!currentTenant) return;
    await uc.update.execute(currentTenant.id, financialId, data);
    setFinancials((prev) => prev.map((f) => f.id === financialId ? { ...f, ...data } : f));
    storeEvents.emit(StoreEvents.FINANCIALS_UPDATED);
  }, [currentTenant, uc.update]);

  const markPaid = useCallback(async (financialId: string, paymentDate: Date) => {
    if (!currentTenant) return;
    await uc.markPaid.execute(currentTenant.id, financialId, paymentDate);
    setFinancials((prev) => prev.map((f) =>
      f.id === financialId ? { ...f, status: 'Pago' as FinancialStatus, paymentDate } : f,
    ));
    storeEvents.emit(StoreEvents.FINANCIALS_UPDATED);
  }, [currentTenant, uc.markPaid]);

  const updateFinancialStatus = useCallback(async (financialId: string, status: FinancialStatus, paymentDate?: Date) => {
    if (!currentTenant) return;
    await uc.updateStatus.execute(currentTenant.id, financialId, status, paymentDate);
    setFinancials((prev) => prev.map((f) =>
      f.id === financialId ? { ...f, status, ...(paymentDate ? { paymentDate } : {}) } : f,
    ));
    storeEvents.emit(StoreEvents.FINANCIALS_UPDATED);
  }, [currentTenant, uc.updateStatus]);

  const deleteFinancial = useCallback(async (financialId: string) => {
    if (!currentTenant) return;
    await uc.delete.execute(currentTenant.id, financialId);
    setFinancials((prev) => prev.filter((f) => f.id !== financialId));
    storeEvents.emit(StoreEvents.FINANCIALS_UPDATED);
  }, [currentTenant, uc.delete]);

  return (
    <FinancialStoreContext.Provider value={{
      financials, isLoading, createFinancial, updateFinancial,
      markPaid, updateFinancialStatus, deleteFinancial, refresh,
    }}>
      {children}
    </FinancialStoreContext.Provider>
  );
};
