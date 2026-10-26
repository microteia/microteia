import type { EntityRecord } from '../../entities/EntityRecord';
import type { IRecordRepository } from '../../repositories/IRecordRepository';
import type { MemberVisibilityFilter } from '../../schema/memberVisibility';

export type SubscribeToRecordsUseCase = {
  execute: (
    tenantId: string,
    collection: string,
    onUpdate: (records: EntityRecord[]) => void,
    onError?: (collection: string, error: Error) => void,
    visibleTo?: MemberVisibilityFilter | null,
  ) => () => void;
};

export const makeSubscribeToRecordsUseCase = (repo: IRecordRepository): SubscribeToRecordsUseCase => ({
  execute: (tenantId, collection, onUpdate, onError, visibleTo) =>
    repo.subscribe(tenantId, collection, onUpdate, onError, visibleTo),
});
