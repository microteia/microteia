import type { ICaseDocumentRepository } from '../../repositories/ICaseDocumentRepository';

export type DeleteCaseDocumentUseCase = { execute: (tenantId: string, caseId: string, documentId: string, storagePath: string) => Promise<void> };
export const makeDeleteCaseDocumentUseCase = (repo: ICaseDocumentRepository): DeleteCaseDocumentUseCase => ({
  execute: (tenantId, caseId, documentId, storagePath) => repo.deleteDocument(tenantId, caseId, documentId, storagePath),
});
