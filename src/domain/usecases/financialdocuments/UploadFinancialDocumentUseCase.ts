import type { IFinancialDocumentRepository } from '../../repositories/IFinancialDocumentRepository';

export type UploadFinancialDocumentUseCase = {
  execute: (tenantId: string, financialId: string, file: File) => Promise<string>;
};

export const makeUploadFinancialDocumentUseCase = (repo: IFinancialDocumentRepository): UploadFinancialDocumentUseCase => ({
  execute: (tenantId, financialId, file) => repo.uploadDocument(tenantId, financialId, file),
});
