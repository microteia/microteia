import type { IPersonDocumentRepository } from '../../repositories/IPersonDocumentRepository';
import type { PersonDocument } from '../../entities';

export type GetPersonDocumentsUseCase = {
  execute: (tenantId: string, personId: string) => Promise<PersonDocument[]>;
};

export const makeGetPersonDocumentsUseCase = (repo: IPersonDocumentRepository): GetPersonDocumentsUseCase => ({
  execute: (tenantId, personId) => repo.getDocuments(tenantId, personId),
});
