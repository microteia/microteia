import type { IPushRepository } from '../../repositories/IPushRepository';
import type { PushStatus } from '../../entities';

export type UpdatePushStatusUseCase = {
  execute: (pushId: string, status: PushStatus) => Promise<void>;
};

export const makeUpdatePushStatusUseCase = (repo: IPushRepository): UpdatePushStatusUseCase => ({
  execute: (pushId, status) => repo.updatePushStatus(pushId, status),
});
