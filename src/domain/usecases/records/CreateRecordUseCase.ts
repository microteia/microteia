import type { EntityRecord, EntityRecordValues } from '../../entities/EntityRecord';
import type { IRecordRepository } from '../../repositories/IRecordRepository';

export type CreateRecordUseCase = {
  execute: (
    tenantId: string,
    collection: string,
    data: EntityRecordValues,
    recordId?: string,
  ) => Promise<EntityRecord>;
};

export const makeCreateRecordUseCase = (repo: IRecordRepository): CreateRecordUseCase => ({
  execute: (tenantId, collection, data, recordId) => repo.create(tenantId, collection, data, recordId),
});
