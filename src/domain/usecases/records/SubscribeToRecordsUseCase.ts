import type { EntityRecord } from '../../entities/EntityRecord';
import type { IRecordRepository } from '../../repositories/IRecordRepository';

export type SubscribeToRecordsUseCase = {
  execute: (
    tenantId: string,
    collection: string,
    onUpdate: (records: EntityRecord[]) => void,
  ) => () => void;
};

export const makeSubscribeToRecordsUseCase = (repo: IRecordRepository): SubscribeToRecordsUseCase => ({
  execute: (tenantId, collection, onUpdate) => repo.subscribe(tenantId, collection, onUpdate),
});
