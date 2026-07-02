import { createContext, useContext } from 'react';
import type { Financial, FinancialStatus } from '../domain/entities';

export interface FinancialStoreContextValue {
  financials: Financial[];
  isLoading: boolean;
  createFinancial: (data: Omit<Financial, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<Financial>;
  updateFinancial: (financialId: string, data: Partial<Omit<Financial, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => Promise<void>;
  markPaid: (financialId: string, paymentDate: Date) => Promise<void>;
  updateFinancialStatus: (financialId: string, status: FinancialStatus, paymentDate?: Date) => Promise<void>;
  cancelFinancial: (financialId: string, cancelDate: Date) => Promise<void>;
  deleteFinancial: (financialId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const FinancialStoreContext = createContext<FinancialStoreContextValue | null>(null);

export const useFinancialStore = (): FinancialStoreContextValue => {
  const ctx = useContext(FinancialStoreContext);
  if (!ctx) throw new Error('useFinancialStore must be used within FinancialStoreProvider');
  return ctx;
};
