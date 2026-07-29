import type { EntityRecordValues } from '../../entities/EntityRecord';
import type { IRecordRepository } from '../../repositories/IRecordRepository';

export type UpdateRecordUseCase = {
  execute: (tenantId: string, collection: string, recordId: string, data: EntityRecordValues) => Promise<void>;
};

export const makeUpdateRecordUseCase = (repo: IRecordRepository): UpdateRecordUseCase => ({
  execute: (tenantId, collection, recordId, data) => repo.update(tenantId, collection, recordId, data),
});
