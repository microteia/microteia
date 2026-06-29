import { createContext, useContext } from 'react';
import type { Deadline, DeadlineStatus } from '../domain/entities';

export interface DeadlineStoreContextValue {
  deadlines: Deadline[];
  isLoading: boolean;
  createDeadline: (data: Omit<Deadline, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<Deadline>;
  updateDeadline: (deadlineId: string, data: Partial<Omit<Deadline, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => Promise<void>;
  completeDeadline: (deadlineId: string, completedBy: string) => Promise<void>;
  updateDeadlineStatus: (deadlineId: string, status: DeadlineStatus) => Promise<void>;
  deleteDeadline: (deadlineId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const DeadlineStoreContext = createContext<DeadlineStoreContextValue | null>(null);

export const useDeadlineStore = (): DeadlineStoreContextValue => {
  const ctx = useContext(DeadlineStoreContext);
  if (!ctx) throw new Error('useDeadlineStore must be used within DeadlineStoreProvider');
  return ctx;
};
