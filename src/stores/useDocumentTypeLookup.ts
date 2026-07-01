import { createContext, useContext } from 'react';
import type { DocumentTypeConfig } from '../domain/entities';

export interface DocumentTypeLookupStoreState {
  typeConfigs: DocumentTypeConfig[];
  loading: boolean;
  addItem: (name: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export const DocumentTypeLookupContext = createContext<DocumentTypeLookupStoreState | null>(null);

export const useDocumentTypeLookup = (): DocumentTypeLookupStoreState => {
  const ctx = useContext(DocumentTypeLookupContext);
  if (!ctx) throw new Error('useDocumentTypeLookup must be used within DocumentTypeLookupStoreProvider');
  return ctx;
};
