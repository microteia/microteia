import { createContext, useContext } from 'react';
import type { NewsCategoryConfig } from '../domain/entities';

export interface NewsCategoryLookupStoreState {
  categoryConfigs: NewsCategoryConfig[];
  loading: boolean;
  addItem: (name: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export const NewsCategoryLookupContext = createContext<NewsCategoryLookupStoreState | null>(null);

export const useNewsCategoryLookup = (): NewsCategoryLookupStoreState => {
  const ctx = useContext(NewsCategoryLookupContext);
  if (!ctx) throw new Error('useNewsCategoryLookup must be used within NewsCategoryLookupStoreProvider');
  return ctx;
};
