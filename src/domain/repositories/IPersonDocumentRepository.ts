import type { PersonDocument, DeletionActor } from '../entities';

export interface IPersonDocumentRepository {
  getDocuments(tenantId: string, personId: string): Promise<PersonDocument[]>;
  uploadDocument(tenantId: string, personId: string, file: File): Promise<string>;
  addDocument(tenantId: string, personId: string, data: Omit<PersonDocument, 'id' | 'personId' | 'tenantId' | 'createdAt'>): Promise<PersonDocument>;
  deleteDocument(tenantId: string, personId: string, documentId: string, storagePath: string, actor: DeletionActor): Promise<void>;
}
