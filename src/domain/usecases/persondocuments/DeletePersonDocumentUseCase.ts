import type { IPersonDocumentRepository } from '../../repositories/IPersonDocumentRepository';
import type { DeletionActor } from '../../entities';

export type DeletePersonDocumentUseCase = {
  execute: (tenantId: string, personId: string, documentId: string, storagePath: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeletePersonDocumentUseCase = (repo: IPersonDocumentRepository): DeletePersonDocumentUseCase => ({
  execute: (tenantId, personId, documentId, storagePath, actor) => repo.deleteDocument(tenantId, personId, documentId, storagePath, actor),
});
