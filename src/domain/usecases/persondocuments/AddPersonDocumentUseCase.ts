import type { IPersonDocumentRepository } from '../../repositories/IPersonDocumentRepository';
import type { PersonDocument } from '../../entities';

export type AddPersonDocumentUseCase = {
  execute: (tenantId: string, personId: string, data: Omit<PersonDocument, 'id' | 'personId' | 'tenantId' | 'createdAt'>) => Promise<PersonDocument>;
};

export const makeAddPersonDocumentUseCase = (repo: IPersonDocumentRepository): AddPersonDocumentUseCase => ({
  execute: (tenantId, personId, data) => repo.addDocument(tenantId, personId, data),
});
