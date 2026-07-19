import type { DocumentTypeConfig } from '../entities';

export interface IDocumentTypeRepository {
  getAll(tenantId: string): Promise<DocumentTypeConfig[]>;
  subscribe(tenantId: string, onChange: (items: DocumentTypeConfig[]) => void): () => void;
  create(tenantId: string, key: string, label: string, createdBy: string): Promise<DocumentTypeConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
