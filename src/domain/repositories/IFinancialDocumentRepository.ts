import type { FinancialDocument } from '../entities';

export interface IFinancialDocumentRepository {
  getDocuments(tenantId: string, financialId: string): Promise<FinancialDocument[]>;
  uploadDocument(tenantId: string, financialId: string, file: File): Promise<string>;
  addDocument(tenantId: string, financialId: string, data: Omit<FinancialDocument, 'id' | 'financialId' | 'tenantId' | 'createdAt'>): Promise<FinancialDocument>;
  deleteDocument(tenantId: string, financialId: string, documentId: string, storagePath: string): Promise<void>;
}
