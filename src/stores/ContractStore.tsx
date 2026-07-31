import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ContractStoreContext } from './useContractStore';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeSubscribeToContractsUseCase } from '../domain/usecases/contracts/SubscribeToContractsUseCase';
import { makeCreateContractUseCase } from '../domain/usecases/contracts/CreateContractUseCase';
import { makeUpdateContractUseCase } from '../domain/usecases/contracts/UpdateContractUseCase';
import { makeDeleteContractUseCase } from '../domain/usecases/contracts/DeleteContractUseCase';
import type { Contract, DeletionActor } from '../domain/entities';

export const ContractStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const { contractRepository } = useDI();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    subscribe: makeSubscribeToContractsUseCase(contractRepository),
    create: makeCreateContractUseCase(contractRepository),
    update: makeUpdateContractUseCase(contractRepository),
    delete: makeDeleteContractUseCase(contractRepository),
  }), [contractRepository]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setContracts([]);
      return;
    }
    setIsLoading(true);
    const unsubscribe = uc.subscribe.execute(currentTenant.id, (list) => {
      setContracts(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [currentTenant, uc.subscribe]);

  const createContract = useCallback(async (data: Omit<Contract, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, data);
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
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.delete.execute(currentTenant.id, contractId, actor);
    setContracts((prev) => prev.filter((c) => c.id !== contractId));
    storeEvents.emit(StoreEvents.CONTRACTS_UPDATED);
  }, [currentTenant, uc.delete, user, effectiveName]);

  return (
    <ContractStoreContext.Provider value={{ contracts, isLoading, createContract, updateContract, deleteContract }}>
      {children}
    </ContractStoreContext.Provider>
  );
};
