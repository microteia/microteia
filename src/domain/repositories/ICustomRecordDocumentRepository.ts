import type { CustomRecordDocument, DeletionActor } from '../entities';

export interface ICustomRecordDocumentRepository {
  getDocuments(tenantId: string, recordId: string): Promise<CustomRecordDocument[]>;
  uploadDocument(tenantId: string, recordId: string, file: File): Promise<string>;
  addDocument(tenantId: string, recordId: string, data: Omit<CustomRecordDocument, 'id' | 'recordId' | 'tenantId' | 'createdAt'>): Promise<CustomRecordDocument>;
  deleteDocument(tenantId: string, recordId: string, documentId: string, storagePath: string, actor: DeletionActor): Promise<void>;
}
