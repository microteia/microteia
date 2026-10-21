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

/**
 * O store quando ele pode não existir — no PORTAL, quem filtra é convidado, não membro, e não há
 * filtro salvo do escritório para ele. Sem o provedor, o filtro funciona e só não se salva.
 */
export const useOptionalSavedFilter = (): SavedFilterContextValue | null => useContext(SavedFilterContext);

export const useSavedFilter = (): SavedFilterContextValue => {
  const ctx = useContext(SavedFilterContext);
  if (!ctx) throw new Error('useSavedFilter must be used within SavedFilterStoreProvider');
  return ctx;
};
