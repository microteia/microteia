import type { CaseDocument, DeletionActor } from '../entities';

export interface ICaseDocumentRepository {
  getDocuments(tenantId: string, caseId: string): Promise<CaseDocument[]>;
  uploadDocument(tenantId: string, caseId: string, file: File): Promise<string>;
  addDocument(tenantId: string, caseId: string, data: Omit<CaseDocument, 'id' | 'caseId' | 'tenantId' | 'createdAt'>): Promise<CaseDocument>;
  deleteDocument(tenantId: string, caseId: string, documentId: string, storagePath: string, actor: DeletionActor): Promise<void>;
}
