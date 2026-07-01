import { createContext, useContext } from 'react';
import type { ContractTag } from '../domain/entities';

export interface ContractTagContextValue {
  tags: ContractTag[];
  loading: boolean;
  getTagsForContract: (contractId: string, tagIds: string[]) => ContractTag[];
  setTagsForContract: (contractId: string, tagIds: string[]) => Promise<void>;
  createTag: (name: string, color: string) => Promise<ContractTag>;
  updateTag: (tagId: string, data: { name: string; color: string }) => Promise<void>;
  deleteTag: (tagId: string) => Promise<void>;
}

export const ContractTagContext = createContext<ContractTagContextValue | null>(null);

export const useContractTagStore = (): ContractTagContextValue => {
  const ctx = useContext(ContractTagContext);
  if (!ctx) throw new Error('useContractTagStore must be used within ContractTagStoreProvider');
  return ctx;
};
