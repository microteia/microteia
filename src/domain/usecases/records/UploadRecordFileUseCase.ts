import type { IRecordFileRepository } from '../../repositories/IRecordRepository';

export type UploadRecordFileUseCase = {
  execute: (
    tenantId: string,
    collection: string,
    recordId: string,
    fieldKey: string,
    file: File,
  ) => Promise<string>;
};

export const makeUploadRecordFileUseCase = (
  repo: IRecordFileRepository,
): UploadRecordFileUseCase => ({
  execute: (tenantId, collection, recordId, fieldKey, file) =>
    repo.upload(tenantId, collection, recordId, fieldKey, file),
});
