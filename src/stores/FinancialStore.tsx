import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { FinancialStoreContext } from './useFinancialStore';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeSubscribeToFinancialsUseCase } from '../domain/usecases/financials/SubscribeToFinancialsUseCase';
import { makeCreateFinancialUseCase } from '../domain/usecases/financials/CreateFinancialUseCase';
import {
  makeUpdateFinancialUseCase,
  makeMarkFinancialPaidUseCase,
  makeUpdateFinancialStatusUseCase,
  makeCancelFinancialUseCase,
} from '../domain/usecases/financials/UpdateFinancialUseCase';
import { makeDeleteFinancialUseCase } from '../domain/usecases/financials/DeleteFinancialUseCase';
import type { Financial, FinancialStatus, DeletionActor } from '../domain/entities';

export const FinancialStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const { financialRepository } = useDI();

  const [financials, setFinancials] = useState<Financial[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    subscribe: makeSubscribeToFinancialsUseCase(financialRepository),
    create: makeCreateFinancialUseCase(financialRepository),
    update: makeUpdateFinancialUseCase(financialRepository),
    markPaid: makeMarkFinancialPaidUseCase(financialRepository),
    updateStatus: makeUpdateFinancialStatusUseCase(financialRepository),
    cancel: makeCancelFinancialUseCase(financialRepository),
    delete: makeDeleteFinancialUseCase(financialRepository),
  }), [financialRepository]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setFinancials([]);
      return;
    }
    setIsLoading(true);
    const unsubscribe = uc.subscribe.execute(currentTenant.id, (list) => {
      setFinancials(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [currentTenant, uc.subscribe]);

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
      f.id === financialId
        ? { ...f, status, paymentDate: status === 'Pago' && paymentDate ? paymentDate : status !== 'Pago' ? null : f.paymentDate }
        : f,
    ));
    storeEvents.emit(StoreEvents.FINANCIALS_UPDATED);
  }, [currentTenant, uc.updateStatus]);

  const cancelFinancial = useCallback(async (financialId: string, cancelDate: Date) => {
    if (!currentTenant) return;
    await uc.cancel.execute(currentTenant.id, financialId, cancelDate);
    setFinancials((prev) => prev.map((f) =>
      f.id === financialId ? { ...f, status: 'Cancelado' as FinancialStatus, cancelDate } : f,
    ));
    storeEvents.emit(StoreEvents.FINANCIALS_UPDATED);
  }, [currentTenant, uc.cancel]);

  const deleteFinancial = useCallback(async (financialId: string) => {
    if (!currentTenant) return;
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.delete.execute(currentTenant.id, financialId, actor);
    setFinancials((prev) => prev.filter((f) => f.id !== financialId));
    storeEvents.emit(StoreEvents.FINANCIALS_UPDATED);
  }, [currentTenant, uc.delete, user, effectiveName]);

  return (
    <FinancialStoreContext.Provider value={{
      financials, isLoading, createFinancial, updateFinancial,
      markPaid, updateFinancialStatus, cancelFinancial, deleteFinancial,
    }}>
      {children}
    </FinancialStoreContext.Provider>
  );
};
