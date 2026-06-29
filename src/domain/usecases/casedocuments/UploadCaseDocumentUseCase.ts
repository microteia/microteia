import type { ICaseDocumentRepository } from '../../repositories/ICaseDocumentRepository';

export type UploadCaseDocumentUseCase = { execute: (tenantId: string, caseId: string, file: File) => Promise<string> };
export const makeUploadCaseDocumentUseCase = (repo: ICaseDocumentRepository): UploadCaseDocumentUseCase => ({
  execute: (tenantId, caseId, file) => repo.uploadDocument(tenantId, caseId, file),
});
