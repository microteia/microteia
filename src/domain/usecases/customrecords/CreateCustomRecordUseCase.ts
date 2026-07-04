import type { CustomRecord } from '../../entities';
import type { ICustomRecordRepository } from '../../repositories/ICustomRecordRepository';

export type CreateCustomRecordUseCase = {
  execute: (tenantId: string, data: Omit<CustomRecord, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<CustomRecord>;
};

export const makeCreateCustomRecordUseCase = (repo: ICustomRecordRepository): CreateCustomRecordUseCase => ({
  execute: (tenantId, data) => repo.create(tenantId, data),
});
