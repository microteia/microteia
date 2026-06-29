import { createContext, useContext } from 'react';
import type { DeadlineTypeConfig } from '../domain/entities';

export interface DeadlineLookupStoreState {
  typeConfigs: DeadlineTypeConfig[];
  loading: boolean;
  addType: (name: string) => Promise<void>;
  removeType: (key: string) => Promise<void>;
}

export const DeadlineLookupContext = createContext<DeadlineLookupStoreState | null>(null);

export const useDeadlineLookup = (): DeadlineLookupStoreState => {
  const ctx = useContext(DeadlineLookupContext);
  if (!ctx) throw new Error('useDeadlineLookup must be used within DeadlineLookupStoreProvider');
  return ctx;
};
