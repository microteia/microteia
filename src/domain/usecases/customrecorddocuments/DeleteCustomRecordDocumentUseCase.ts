import type { ICustomRecordDocumentRepository } from '../../repositories/ICustomRecordDocumentRepository';
import type { DeletionActor } from '../../entities';

export type DeleteCustomRecordDocumentUseCase = {
  execute: (tenantId: string, recordId: string, documentId: string, storagePath: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteCustomRecordDocumentUseCase = (repo: ICustomRecordDocumentRepository): DeleteCustomRecordDocumentUseCase => ({
  execute: (tenantId, recordId, documentId, storagePath, actor) => repo.deleteDocument(tenantId, recordId, documentId, storagePath, actor),
});
