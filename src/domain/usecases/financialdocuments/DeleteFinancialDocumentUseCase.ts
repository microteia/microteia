import type { IFinancialDocumentRepository } from '../../repositories/IFinancialDocumentRepository';

export type DeleteFinancialDocumentUseCase = {
  execute: (tenantId: string, financialId: string, documentId: string, storagePath: string) => Promise<void>;
};

export const makeDeleteFinancialDocumentUseCase = (repo: IFinancialDocumentRepository): DeleteFinancialDocumentUseCase => ({
  execute: (tenantId, financialId, documentId, storagePath) => repo.deleteDocument(tenantId, financialId, documentId, storagePath),
});
