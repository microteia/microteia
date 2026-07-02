import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ContractStoreContext } from './useContractStore';
import { useTenant } from './useTenant';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeGetContractsUseCase } from '../domain/usecases/contracts/GetContractsUseCase';
import { makeCreateContractUseCase } from '../domain/usecases/contracts/CreateContractUseCase';
import { makeUpdateContractUseCase } from '../domain/usecases/contracts/UpdateContractUseCase';
import { makeDeleteContractUseCase } from '../domain/usecases/contracts/DeleteContractUseCase';
import type { Contract } from '../domain/entities';

export const ContractStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { contractRepository, caseRepository, financialRepository } = useDI();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    get: makeGetContractsUseCase(contractRepository),
    create: makeCreateContractUseCase(contractRepository),
    update: makeUpdateContractUseCase(contractRepository),
    delete: makeDeleteContractUseCase(contractRepository, caseRepository, financialRepository),
  }), [contractRepository, caseRepository, financialRepository]);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      const list = await uc.get.execute(currentTenant.id);
      setContracts(list);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, uc.get]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- triggering async refresh on mount/tenant change is architecturally required
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.CONTRACTS_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  const createContract = useCallback(async (data: Omit<Contract, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, data);
    setContracts((prev) => [item, ...prev]);
    storeEvents.emit(StoreEvents.CONTRACTS_UPDATED);
    return item;
  }, [currentTenant, uc.create]);

  const updateContract = useCallback(async (contractId: string, data: Partial<Omit<Contract, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => {
    if (!currentTenant) return;
    await uc.update.execute(currentTenant.id, contractId, data);
    setContracts((prev) => prev.map((c) => c.id === contractId ? { ...c, ...data } : c));
    storeEvents.emit(StoreEvents.CONTRACTS_UPDATED);
  }, [currentTenant, uc.update]);

  const deleteContract = useCallback(async (contractId: string) => {
    if (!currentTenant) return;
    await uc.delete.execute(currentTenant.id, contractId);
    setContracts((prev) => prev.filter((c) => c.id !== contractId));
    storeEvents.emit(StoreEvents.CONTRACTS_UPDATED);
    storeEvents.emit(StoreEvents.CASES_UPDATED);
  }, [currentTenant, uc.delete]);

  return (
    <ContractStoreContext.Provider value={{ contracts, isLoading, createContract, updateContract, deleteContract, refresh }}>
      {children}
    </ContractStoreContext.Provider>
  );
};
