import { createContext, useContext } from 'react';
import type { Person, PersonStatus } from '../domain/entities';

export interface PersonStoreContextValue {
  persons: Person[];
  isLoading: boolean;
  createPerson: (data: Omit<Person, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<Person>;
  updatePerson: (personId: string, data: Partial<Omit<Person, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => Promise<void>;
  updatePersonStatus: (personId: string, status: PersonStatus) => Promise<void>;
  deletePerson: (personId: string) => Promise<void>;
}

export const PersonStoreContext = createContext<PersonStoreContextValue | null>(null);

export const usePersonStore = (): PersonStoreContextValue => {
  const ctx = useContext(PersonStoreContext);
  if (!ctx) throw new Error('usePersonStore must be used within PersonStoreProvider');
  return ctx;
};
