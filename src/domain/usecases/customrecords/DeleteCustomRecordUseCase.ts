import type { DeletionActor } from '../../entities';
import type { ICustomRecordRepository } from '../../repositories/ICustomRecordRepository';

export type DeleteCustomRecordUseCase = {
  execute: (tenantId: string, recordId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteCustomRecordUseCase = (repo: ICustomRecordRepository): DeleteCustomRecordUseCase => ({
  execute: (tenantId, recordId, actor) => repo.delete(tenantId, recordId, actor),
});
