import type { IDeadlineRepository } from '../../repositories/IDeadlineRepository';
import type { DeletionActor } from '../../entities';

export type DeleteDeadlineUseCase = {
  execute: (tenantId: string, deadlineId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteDeadlineUseCase = (repo: IDeadlineRepository): DeleteDeadlineUseCase => ({
  execute: (tenantId, deadlineId, actor) => repo.deleteDeadline(tenantId, deadlineId, actor),
});
