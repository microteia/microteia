import type { ICustomRecordDocumentRepository } from '../../repositories/ICustomRecordDocumentRepository';
import type { CustomRecordDocument } from '../../entities';

export type AddCustomRecordDocumentUseCase = {
  execute: (tenantId: string, recordId: string, data: Omit<CustomRecordDocument, 'id' | 'recordId' | 'tenantId' | 'createdAt'>) => Promise<CustomRecordDocument>;
};

export const makeAddCustomRecordDocumentUseCase = (repo: ICustomRecordDocumentRepository): AddCustomRecordDocumentUseCase => ({
  execute: (tenantId, recordId, data) => repo.addDocument(tenantId, recordId, data),
});
