import { createContext, useContext } from 'react';
import type { CaseTag } from '../domain/entities';

export interface CaseTagContextValue {
  tags: CaseTag[];
  loading: boolean;
  getTagsForCase: (caseId: string, tagIds: string[]) => CaseTag[];
  setTagsForCase: (caseId: string, tagIds: string[]) => Promise<void>;
  createTag: (name: string, color: string) => Promise<CaseTag>;
  updateTag: (tagId: string, data: { name: string; color: string }) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
}

export const CaseTagContext = createContext<CaseTagContextValue | null>(null);

export const useCaseTagStore = (): CaseTagContextValue => {
  const ctx = useContext(CaseTagContext);
  if (!ctx) throw new Error('useCaseTagStore must be used within CaseTagStoreProvider');
  return ctx;
};
