import type { CustomRecord } from '../../entities';
import type { ICustomRecordRepository } from '../../repositories/ICustomRecordRepository';

export type SubscribeToCustomRecordsUseCase = {
  execute: (tenantId: string, screenKey: string, onUpdate: (records: CustomRecord[]) => void) => () => void;
};

export const makeSubscribeToCustomRecordsUseCase = (repo: ICustomRecordRepository): SubscribeToCustomRecordsUseCase => ({
  execute: (tenantId, screenKey, onUpdate) => repo.subscribeByScreen(tenantId, screenKey, onUpdate),
});
