import { createContext, useContext } from 'react';
import type { EntityRecord, EntityRecordValues } from '../domain/entities';

export interface RecordStoreState {
  /** Registros por COLEÇÃO — a mesma chave que identifica a tela e a entidade. */
  recordsByCollection: Record<string, EntityRecord[]>;
  allRecords: EntityRecord[];
  isLoading: boolean;
  createRecord: (collection: string, data: EntityRecordValues) => Promise<EntityRecord>;
  updateRecord: (collection: string, recordId: string, data: EntityRecordValues) => Promise<void>;
  deleteRecord: (collection: string, recordId: string) => Promise<void>;
}

export const RecordContext = createContext<RecordStoreState | null>(null);

export const useRecords = (): RecordStoreState => {
  const ctx = useContext(RecordContext);
  if (!ctx) throw new Error('useRecords must be used within RecordStoreProvider');
  return ctx;
};
