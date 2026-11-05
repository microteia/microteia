import type { IRecordRepository } from '../../repositories/IRecordRepository';
import type { MemberVisibilityFilter } from '../../schema/memberVisibility';
import type { RecordCountSpec } from '../../services/recordListQuery';

export type CountRecordsUseCase = {
  execute: (tenantId: string, spec: RecordCountSpec, visibleTo?: MemberVisibilityFilter | null) => Promise<number>;
};

export const makeCountRecordsUseCase = (repo: IRecordRepository): CountRecordsUseCase => ({
  execute: (tenantId, spec, visibleTo) => repo.count(tenantId, spec, visibleTo),
});
