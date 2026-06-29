import { createContext, useContext } from 'react';
import type { PersonLookupConfig, PersonLookupKind } from '../domain/entities';

export interface PersonLookupStoreState {
  typeConfigs:          PersonLookupConfig[];
  occupationConfigs:    PersonLookupConfig[];
  nationalityConfigs:   PersonLookupConfig[];
  maritalStatusConfigs: PersonLookupConfig[];
  cityConfigs:          PersonLookupConfig[];
  relationshipConfigs:  PersonLookupConfig[];
  loading: boolean;
  addItem:    (kind: PersonLookupKind, name: string) => Promise<void>;
  removeItem: (kind: PersonLookupKind, key: string) => Promise<void>;
}

export const PersonLookupContext = createContext<PersonLookupStoreState | null>(null);

export const usePersonLookup = (): PersonLookupStoreState => {
  const ctx = useContext(PersonLookupContext);
  if (!ctx) throw new Error('usePersonLookup must be used within PersonLookupStoreProvider');
  return ctx;
};
