import type { IRecordRepository } from '../../repositories/IRecordRepository';
import type { MemberVisibilityFilter } from '../../schema/memberVisibility';
import type { RecordCountSpec } from '../../services/recordListQuery';

export type SumRecordsUseCase = {
  execute: (tenantId: string, spec: RecordCountSpec, field: string, visibleTo?: MemberVisibilityFilter | null) => Promise<number>;
};

export const makeSumRecordsUseCase = (repo: IRecordRepository): SumRecordsUseCase => ({
  execute: (tenantId, spec, field, visibleTo) => repo.sum(tenantId, spec, field, visibleTo),
});
