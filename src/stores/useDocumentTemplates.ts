import { createContext, useContext } from 'react';
import type { DocumentTemplate } from '../domain/schema/document/documentTemplate';
import type {
  DocumentTemplateInput,
  GenerateDocumentInput,
  GenerateDocumentResult,
  PreviewDocumentInput,
  PreviewDocumentResult,
} from '../domain/repositories/IDocumentTemplateRepository';

export interface DocumentTemplateStoreState {
  /** Os modelos que o ESCRITÓRIO gravou. Os de pacote vêm das contribuições — ver `useResolvedDocumentTemplates`. */
  templates: DocumentTemplate[];
  isLoading: boolean;
  saveTemplate: (input: DocumentTemplateInput) => Promise<void>;
  deleteTemplate: (key: string) => Promise<void>;
  /** Gera no servidor. O `tenantId` é do escritório corrente — quem chama não o informa. */
  generateDocument: (input: Omit<GenerateDocumentInput, 'tenantId'>) => Promise<GenerateDocumentResult>;
  /** A pré-visualização do rascunho do editor. O `tenantId` é do escritório corrente. */
  previewDocument: (input: Omit<PreviewDocumentInput, 'tenantId'>) => Promise<PreviewDocumentResult>;
  refresh: () => Promise<void>;
}

export const DocumentTemplateContext = createContext<DocumentTemplateStoreState | null>(null);

export const useDocumentTemplates = (): DocumentTemplateStoreState => {
  const ctx = useContext(DocumentTemplateContext);
  if (!ctx) throw new Error('useDocumentTemplates must be used within DocumentTemplateStoreProvider');
  return ctx;
};
