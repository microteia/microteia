import type { IContractDocumentRepository } from '../../repositories/IContractDocumentRepository';

export type DeleteContractDocumentUseCase = {
  execute: (tenantId: string, contractId: string, documentId: string, storagePath: string) => Promise<void>;
};

export const makeDeleteContractDocumentUseCase = (repo: IContractDocumentRepository): DeleteContractDocumentUseCase => ({
  execute: (tenantId, contractId, documentId, storagePath) => repo.deleteDocument(tenantId, contractId, documentId, storagePath),
});
