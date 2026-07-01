import type { ContractDocument } from '../entities';

export interface IContractDocumentRepository {
  getDocuments(tenantId: string, contractId: string): Promise<ContractDocument[]>;
  uploadDocument(tenantId: string, contractId: string, file: File): Promise<string>;
  addDocument(tenantId: string, contractId: string, data: Omit<ContractDocument, 'id' | 'contractId' | 'tenantId' | 'createdAt'>): Promise<ContractDocument>;
  deleteDocument(tenantId: string, contractId: string, documentId: string, storagePath: string): Promise<void>;
}
