import { createContext, useContext } from 'react';
import type { CustomRecord } from '../domain/entities';

export interface CustomRecordStoreState {
  recordsByScreen: Record<string, CustomRecord[]>;
  allRecords: CustomRecord[];
  isLoading: boolean;
  createRecord: (data: Omit<CustomRecord, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<CustomRecord>;
  updateRecord: (recordId: string, screenKey: string, data: Partial<Omit<CustomRecord, 'id' | 'tenantId' | 'screenKey' | 'createdAt' | 'createdBy'>>) => Promise<void>;
  deleteRecord: (recordId: string, screenKey: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const CustomRecordContext = createContext<CustomRecordStoreState | null>(null);

export const useCustomRecords = (): CustomRecordStoreState => {
  const ctx = useContext(CustomRecordContext);
  if (!ctx) throw new Error('useCustomRecords must be used within CustomRecordStoreProvider');
  return ctx;
};
