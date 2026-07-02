import type { IFinancialDocumentRepository } from '../../repositories/IFinancialDocumentRepository';
import type { FinancialDocument } from '../../entities';

export type GetFinancialDocumentsUseCase = {
  execute: (tenantId: string, financialId: string) => Promise<FinancialDocument[]>;
};

export const makeGetFinancialDocumentsUseCase = (repo: IFinancialDocumentRepository): GetFinancialDocumentsUseCase => ({
  execute: (tenantId, financialId) => repo.getDocuments(tenantId, financialId),
});
