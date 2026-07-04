import type { CustomRecord } from '../../entities';
import type { ICustomRecordRepository } from '../../repositories/ICustomRecordRepository';

export type UpdateCustomRecordUseCase = {
  execute: (tenantId: string, recordId: string, data: Partial<Omit<CustomRecord, 'id' | 'tenantId' | 'screenKey' | 'createdAt' | 'createdBy'>>) => Promise<void>;
};

export const makeUpdateCustomRecordUseCase = (repo: ICustomRecordRepository): UpdateCustomRecordUseCase => ({
  execute: (tenantId, recordId, data) => repo.update(tenantId, recordId, data),
});
