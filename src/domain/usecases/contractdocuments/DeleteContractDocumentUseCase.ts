import type { IContractDocumentRepository } from '../../repositories/IContractDocumentRepository';
import type { DeletionActor } from '../../entities';

export type DeleteContractDocumentUseCase = {
  execute: (tenantId: string, contractId: string, documentId: string, storagePath: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteContractDocumentUseCase = (repo: IContractDocumentRepository): DeleteContractDocumentUseCase => ({
  execute: (tenantId, contractId, documentId, storagePath, actor) => repo.deleteDocument(tenantId, contractId, documentId, storagePath, actor),
});
