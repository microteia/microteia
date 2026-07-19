import type { DeletionActor } from '../../entities';
import type { IActionRepository } from '../../repositories/IActionRepository';

export type DeleteActionUseCase = {
  execute: (tenantId: string, actionId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteActionUseCase = (repo: IActionRepository): DeleteActionUseCase => ({
  execute: (tenantId, actionId, actor) => repo.delete(tenantId, actionId, actor),
});
