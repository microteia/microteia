import { createContext, useContext } from 'react';
import type { Case, CaseStatus } from '../domain/entities';

export interface CaseStoreContextValue {
  cases: Case[];
  isLoading: boolean;
  createCase: (data: Omit<Case, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<Case>;
  updateCase: (caseId: string, data: Partial<Omit<Case, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => Promise<void>;
  updateCaseStatus: (caseId: string, status: CaseStatus) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const CaseStoreContext = createContext<CaseStoreContextValue | null>(null);

export const useCaseStore = (): CaseStoreContextValue => {
  const ctx = useContext(CaseStoreContext);
  if (!ctx) throw new Error('useCaseStore must be used within CaseStoreProvider');
  return ctx;
};
