import type { IFinancialDocumentRepository } from '../../repositories/IFinancialDocumentRepository';
import type { FinancialDocument } from '../../entities';

export type AddFinancialDocumentUseCase = {
  execute: (tenantId: string, financialId: string, data: Omit<FinancialDocument, 'id' | 'financialId' | 'tenantId' | 'createdAt'>) => Promise<FinancialDocument>;
};

export const makeAddFinancialDocumentUseCase = (repo: IFinancialDocumentRepository): AddFinancialDocumentUseCase => ({
  execute: (tenantId, financialId, data) => repo.addDocument(tenantId, financialId, data),
});
