import { createContext, useContext } from 'react';
import type { SavedFilter, SavedFilterToken } from '../domain/entities';

export interface SavedFilterContextValue {
  filters: SavedFilter[];
  loading: boolean;
  saveFilter: (
    screenKey: string,
    name: string,
    tokens: SavedFilterToken[],
    existingId?: string | null,
  ) => Promise<SavedFilter>;
  removeFilter: (id: string) => Promise<void>;
}

export const SavedFilterContext = createContext<SavedFilterContextValue | null>(null);

export const useSavedFilter = (): SavedFilterContextValue => {
  const ctx = useContext(SavedFilterContext);
  if (!ctx) throw new Error('useSavedFilter must be used within SavedFilterStoreProvider');
  return ctx;
};
