import type { IPersonDocumentRepository } from '../../repositories/IPersonDocumentRepository';

export type DeletePersonDocumentUseCase = {
  execute: (tenantId: string, personId: string, documentId: string, storagePath: string) => Promise<void>;
};

export const makeDeletePersonDocumentUseCase = (repo: IPersonDocumentRepository): DeletePersonDocumentUseCase => ({
  execute: (tenantId, personId, documentId, storagePath) => repo.deleteDocument(tenantId, personId, documentId, storagePath),
});
