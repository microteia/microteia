import type { IPushRepository } from '../../repositories/IPushRepository';
import type { PushStatus } from '../../entities';

export type UpdatePushStatusUseCase = {
  execute: (tenantId: string, pushId: string, status: PushStatus) => Promise<void>;
};

export const makeUpdatePushStatusUseCase = (repo: IPushRepository): UpdatePushStatusUseCase => ({
  execute: (tenantId, pushId, status) => repo.updatePushStatus(tenantId, pushId, status),
});
