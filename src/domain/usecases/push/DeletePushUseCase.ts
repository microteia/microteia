import type { IPushRepository } from '../../repositories/IPushRepository';

export type DeletePushUseCase = {
  execute: (tenantId: string, pushId: string) => Promise<void>;
};

export const makeDeletePushUseCase = (repo: IPushRepository): DeletePushUseCase => ({
  execute: (tenantId, pushId) => repo.deletePush(tenantId, pushId),
});
