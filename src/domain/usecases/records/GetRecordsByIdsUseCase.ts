import type { EntityRecord } from '../../entities/EntityRecord';
import type { IRecordRepository } from '../../repositories/IRecordRepository';
import type { MemberVisibilityFilter } from '../../schema/memberVisibility';

export type GetRecordsByIdsUseCase = {
  execute: (
    tenantId: string,
    collection: string,
    ids: readonly string[],
    visibleTo?: MemberVisibilityFilter | null,
  ) => Promise<EntityRecord[]>;
};

export const makeGetRecordsByIdsUseCase = (repo: IRecordRepository): GetRecordsByIdsUseCase => ({
  execute: (tenantId, collection, ids, visibleTo) => repo.getByIds(tenantId, collection, ids, visibleTo),
});
