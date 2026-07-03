import type { IFinancialDocumentRepository } from '../../repositories/IFinancialDocumentRepository';
import type { DeletionActor } from '../../entities';

export type DeleteFinancialDocumentUseCase = {
  execute: (tenantId: string, financialId: string, documentId: string, storagePath: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteFinancialDocumentUseCase = (repo: IFinancialDocumentRepository): DeleteFinancialDocumentUseCase => ({
  execute: (tenantId, financialId, documentId, storagePath, actor) => repo.deleteDocument(tenantId, financialId, documentId, storagePath, actor),
});
