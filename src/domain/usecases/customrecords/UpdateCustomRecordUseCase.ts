import type { CustomRecord } from '../../entities';
import type { ICustomRecordRepository } from '../../repositories/ICustomRecordRepository';

export type UpdateCustomRecordUseCase = {
  execute: (tenantId: string, recordId: string, screenKey: string, data: Partial<Omit<CustomRecord, 'id' | 'tenantId' | 'screenKey' | 'createdAt' | 'createdBy'>>) => Promise<void>;
};

export const makeUpdateCustomRecordUseCase = (repo: ICustomRecordRepository): UpdateCustomRecordUseCase => ({
  execute: (tenantId, recordId, screenKey, data) => repo.update(tenantId, recordId, screenKey, data),
});
