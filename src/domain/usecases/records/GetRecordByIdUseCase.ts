import type { EntityRecord } from '../../entities/EntityRecord';
import type { IRecordRepository } from '../../repositories/IRecordRepository';

export type GetRecordByIdUseCase = {
  execute: (tenantId: string, collection: string, recordId: string) => Promise<EntityRecord | null>;
};

export const makeGetRecordByIdUseCase = (repo: IRecordRepository): GetRecordByIdUseCase => ({
  execute: (tenantId, collection, recordId) => repo.getById(tenantId, collection, recordId),
});
