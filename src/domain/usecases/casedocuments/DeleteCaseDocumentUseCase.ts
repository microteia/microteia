import type { ICaseDocumentRepository } from '../../repositories/ICaseDocumentRepository';
import type { DeletionActor } from '../../entities';

export type DeleteCaseDocumentUseCase = { execute: (tenantId: string, caseId: string, documentId: string, storagePath: string, actor: DeletionActor) => Promise<void> };
export const makeDeleteCaseDocumentUseCase = (repo: ICaseDocumentRepository): DeleteCaseDocumentUseCase => ({
  execute: (tenantId, caseId, documentId, storagePath, actor) => repo.deleteDocument(tenantId, caseId, documentId, storagePath, actor),
});
