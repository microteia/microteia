import type { EntityRecord, EntityRecordValues } from '../../entities/EntityRecord';
import type { IRecordRepository } from '../../repositories/IRecordRepository';

export type CreateRecordUseCase = {
  execute: (tenantId: string, collection: string, data: EntityRecordValues) => Promise<EntityRecord>;
};

export const makeCreateRecordUseCase = (repo: IRecordRepository): CreateRecordUseCase => ({
  execute: (tenantId, collection, data) => repo.create(tenantId, collection, data),
});
