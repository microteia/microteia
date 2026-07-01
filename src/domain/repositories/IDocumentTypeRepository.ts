import type { DocumentTypeConfig } from '../entities';

export interface IDocumentTypeRepository {
  getAll(tenantId: string): Promise<DocumentTypeConfig[]>;
  create(tenantId: string, key: string, label: string, createdBy: string): Promise<DocumentTypeConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
