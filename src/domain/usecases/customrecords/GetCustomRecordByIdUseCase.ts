import type { CustomRecord } from '../../entities';
import type { ICustomRecordRepository } from '../../repositories/ICustomRecordRepository';

export type GetCustomRecordByIdUseCase = {
  execute: (tenantId: string, recordId: string) => Promise<CustomRecord | null>;
};

export const makeGetCustomRecordByIdUseCase = (repo: ICustomRecordRepository): GetCustomRecordByIdUseCase => ({
  execute: (tenantId, recordId) => repo.getById(tenantId, recordId),
});
