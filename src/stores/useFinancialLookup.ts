import { createContext, useContext } from 'react';
import type { FinancialLookupConfig, FinancialLookupKind } from '../domain/entities';

export interface FinancialLookupStoreState {
  categoryConfigs: FinancialLookupConfig[];
  statusConfigs: FinancialLookupConfig[];
  loading: boolean;
  addItem: (kind: FinancialLookupKind, name: string) => Promise<void>;
  removeItem: (kind: FinancialLookupKind, key: string) => Promise<void>;
}

export const FinancialLookupContext = createContext<FinancialLookupStoreState | null>(null);

export const useFinancialLookup = (): FinancialLookupStoreState => {
  const ctx = useContext(FinancialLookupContext);
  if (!ctx) throw new Error('useFinancialLookup must be used within FinancialLookupStoreProvider');
  return ctx;
};
