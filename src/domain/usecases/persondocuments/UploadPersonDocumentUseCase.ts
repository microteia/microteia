import type { IPersonDocumentRepository } from '../../repositories/IPersonDocumentRepository';

export type UploadPersonDocumentUseCase = {
  execute: (tenantId: string, personId: string, file: File) => Promise<string>;
};

export const makeUploadPersonDocumentUseCase = (repo: IPersonDocumentRepository): UploadPersonDocumentUseCase => ({
  execute: (tenantId, personId, file) => repo.uploadDocument(tenantId, personId, file),
});
