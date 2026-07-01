import { createContext, useContext } from 'react';
import type { ContractLookupConfig, ContractLookupKind } from '../domain/entities';

export interface ContractLookupStoreState {
  typeConfigs: ContractLookupConfig[];
  categoryConfigs: ContractLookupConfig[];
  statusConfigs: ContractLookupConfig[];
  objectConfigs: ContractLookupConfig[];
  adjustmentIndexConfigs: ContractLookupConfig[];
  adjustmentPeriodicityConfigs: ContractLookupConfig[];
  currencyConfigs: ContractLookupConfig[];
  paymentMethodConfigs: ContractLookupConfig[];
  bankConfigs: ContractLookupConfig[];
  costCenterConfigs: ContractLookupConfig[];
  loading: boolean;
  addItem: (kind: ContractLookupKind, name: string) => Promise<void>;
  removeItem: (kind: ContractLookupKind, key: string) => Promise<void>;
}

export const ContractLookupContext = createContext<ContractLookupStoreState | null>(null);

export const useContractLookup = (): ContractLookupStoreState => {
  const ctx = useContext(ContractLookupContext);
  if (!ctx) throw new Error('useContractLookup must be used within ContractLookupStoreProvider');
  return ctx;
};
