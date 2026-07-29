import type { EntityRecord } from '../../entities/EntityRecord';
import type { IRecordRepository } from '../../repositories/IRecordRepository';

export type GetRecordsUseCase = {
  execute: (tenantId: string, collection: string) => Promise<EntityRecord[]>;
};

export const makeGetRecordsUseCase = (repo: IRecordRepository): GetRecordsUseCase => ({
  execute: (tenantId, collection) => repo.getAll(tenantId, collection),
});
