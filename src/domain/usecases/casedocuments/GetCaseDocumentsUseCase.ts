import type { ICaseDocumentRepository } from '../../repositories/ICaseDocumentRepository';
import type { CaseDocument } from '../../entities';

export type GetCaseDocumentsUseCase = { execute: (tenantId: string, caseId: string) => Promise<CaseDocument[]> };
export const makeGetCaseDocumentsUseCase = (repo: ICaseDocumentRepository): GetCaseDocumentsUseCase => ({
  execute: (tenantId, caseId) => repo.getDocuments(tenantId, caseId),
});
