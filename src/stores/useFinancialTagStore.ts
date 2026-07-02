import { createContext, useContext } from 'react';
import type { FinancialTag } from '../domain/entities';

export interface FinancialTagContextValue {
  tags: FinancialTag[];
  loading: boolean;
  getTagsForFinancial: (financialId: string, tagIds: string[]) => FinancialTag[];
  setTagsForFinancial: (financialId: string, tagIds: string[]) => Promise<void>;
  createTag: (name: string, color: string) => Promise<FinancialTag>;
  updateTag: (tagId: string, data: { name: string; color: string }) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
}

export const FinancialTagContext = createContext<FinancialTagContextValue | null>(null);

export const useFinancialTagStore = (): FinancialTagContextValue => {
  const ctx = useContext(FinancialTagContext);
  if (!ctx) throw new Error('useFinancialTagStore must be used within FinancialTagStoreProvider');
  return ctx;
};
