import type { ICustomRecordDocumentRepository } from '../../repositories/ICustomRecordDocumentRepository';
import type { CustomRecordDocument } from '../../entities';

export type GetCustomRecordDocumentsUseCase = {
  execute: (tenantId: string, recordId: string) => Promise<CustomRecordDocument[]>;
};

export const makeGetCustomRecordDocumentsUseCase = (repo: ICustomRecordDocumentRepository): GetCustomRecordDocumentsUseCase => ({
  execute: (tenantId, recordId) => repo.getDocuments(tenantId, recordId),
});
