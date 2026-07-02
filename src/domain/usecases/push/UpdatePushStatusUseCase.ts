import type { IPushRepository } from '../../repositories/IPushRepository';
import type { PushStatus } from '../../entities';

type PushStatusActor = { updatedBy: string; updatedByName: string; updatedByPhotoURL: string };

export type UpdatePushStatusUseCase = {
  execute: (tenantId: string, pushId: string, status: PushStatus, actor: PushStatusActor) => Promise<void>;
};

export const makeUpdatePushStatusUseCase = (repo: IPushRepository): UpdatePushStatusUseCase => ({
  execute: (tenantId, pushId, status, actor) => repo.updatePushStatus(tenantId, pushId, status, actor),
});
