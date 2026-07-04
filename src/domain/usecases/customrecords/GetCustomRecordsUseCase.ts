import type { CustomRecord } from '../../entities';
import type { ICustomRecordRepository } from '../../repositories/ICustomRecordRepository';

export type GetCustomRecordsUseCase = {
  execute: (tenantId: string, screenKey: string) => Promise<CustomRecord[]>;
};

export const makeGetCustomRecordsUseCase = (repo: ICustomRecordRepository): GetCustomRecordsUseCase => ({
  execute: (tenantId, screenKey) => repo.getByScreen(tenantId, screenKey),
});
