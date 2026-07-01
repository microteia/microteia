import type { IContractDocumentRepository } from '../../repositories/IContractDocumentRepository';

export type UploadContractDocumentUseCase = {
  execute: (tenantId: string, contractId: string, file: File) => Promise<string>;
};

export const makeUploadContractDocumentUseCase = (repo: IContractDocumentRepository): UploadContractDocumentUseCase => ({
  execute: (tenantId, contractId, file) => repo.uploadDocument(tenantId, contractId, file),
});
