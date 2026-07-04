import type { ICustomRecordDocumentRepository } from '../../repositories/ICustomRecordDocumentRepository';

export type UploadCustomRecordDocumentUseCase = {
  execute: (tenantId: string, recordId: string, file: File) => Promise<string>;
};

export const makeUploadCustomRecordDocumentUseCase = (repo: ICustomRecordDocumentRepository): UploadCustomRecordDocumentUseCase => ({
  execute: (tenantId, recordId, file) => repo.uploadDocument(tenantId, recordId, file),
});
