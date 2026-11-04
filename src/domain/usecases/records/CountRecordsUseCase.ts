import type { IRecordRepository } from '../../repositories/IRecordRepository';
import type { MemberVisibilityFilter } from '../../schema/memberVisibility';
import type { RecordQueryClause } from '../../services/recordListQuery';

export type CountRecordsUseCase = {
  execute: (
    tenantId: string,
    collection: string,
    clauses: readonly RecordQueryClause[],
    visibleTo?: MemberVisibilityFilter | null,
  ) => Promise<number>;
};

export const makeCountRecordsUseCase = (repo: IRecordRepository): CountRecordsUseCase => ({
  execute: (tenantId, collection, clauses, visibleTo) => repo.count(tenantId, collection, clauses, visibleTo),
});
