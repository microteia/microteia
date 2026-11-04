import type { EntityRecord } from '../../entities/EntityRecord';
import type { IRecordRepository } from '../../repositories/IRecordRepository';
import type { MemberVisibilityFilter } from '../../schema/memberVisibility';

export type SearchRecordsUseCase = {
  execute: (
    tenantId: string,
    collection: string,
    text: string,
    limit: number,
    visibleTo?: MemberVisibilityFilter | null,
  ) => Promise<EntityRecord[]>;
};

export const makeSearchRecordsUseCase = (repo: IRecordRepository): SearchRecordsUseCase => ({
  execute: (tenantId, collection, text, limit, visibleTo) => repo.search(tenantId, collection, text, limit, visibleTo),
});
