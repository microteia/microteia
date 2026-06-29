import { createContext, useContext } from 'react';
import type { PersonTag } from '../domain/entities';

export interface PersonTagContextValue {
  tags: PersonTag[];
  loading: boolean;
  getTagsForPerson: (personId: string, tagIds: string[]) => PersonTag[];
  setTagsForPerson: (personId: string, tagIds: string[]) => Promise<void>;
  createTag: (name: string, color: string) => Promise<PersonTag>;
  updateTag: (tagId: string, data: { name: string; color: string }) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
}

export const PersonTagContext = createContext<PersonTagContextValue | null>(null);

export const usePersonTagStore = (): PersonTagContextValue => {
  const ctx = useContext(PersonTagContext);
  if (!ctx) throw new Error('usePersonTagStore must be used within PersonTagStoreProvider');
  return ctx;
};
