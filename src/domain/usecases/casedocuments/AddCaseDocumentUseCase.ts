import type { ICaseDocumentRepository } from '../../repositories/ICaseDocumentRepository';
import type { CaseDocument } from '../../entities';

export type AddCaseDocumentUseCase = { execute: (tenantId: string, caseId: string, data: Omit<CaseDocument, 'id' | 'caseId' | 'tenantId' | 'createdAt'>) => Promise<CaseDocument> };
export const makeAddCaseDocumentUseCase = (repo: ICaseDocumentRepository): AddCaseDocumentUseCase => ({
  execute: (tenantId, caseId, data) => repo.addDocument(tenantId, caseId, data),
});
