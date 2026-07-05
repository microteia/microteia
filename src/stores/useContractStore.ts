import { createContext, useContext } from 'react';
import type { Contract } from '../domain/entities';

export interface ContractStoreContextValue {
  contracts: Contract[];
  isLoading: boolean;
  createContract: (data: Omit<Contract, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<Contract>;
  updateContract: (contractId: string, data: Partial<Omit<Contract, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => Promise<void>;
  deleteContract: (contractId: string) => Promise<void>;
}

export const ContractStoreContext = createContext<ContractStoreContextValue | null>(null);

export const useContractStore = (): ContractStoreContextValue => {
  const ctx = useContext(ContractStoreContext);
  if (!ctx) throw new Error('useContractStore must be used within ContractStoreProvider');
  return ctx;
};
