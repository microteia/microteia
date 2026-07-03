import type { IPushRepository } from '../../repositories/IPushRepository';
import type { DeletionActor } from '../../entities';

export type DeletePushUseCase = {
  execute: (tenantId: string, pushId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeletePushUseCase = (repo: IPushRepository): DeletePushUseCase => ({
  execute: (tenantId, pushId, actor) => repo.deletePush(tenantId, pushId, actor),
});
