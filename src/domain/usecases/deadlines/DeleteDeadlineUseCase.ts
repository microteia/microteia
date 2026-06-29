import type { IDeadlineRepository } from '../../repositories/IDeadlineRepository';

export type DeleteDeadlineUseCase = {
  execute: (tenantId: string, deadlineId: string) => Promise<void>;
};

export const makeDeleteDeadlineUseCase = (repo: IDeadlineRepository): DeleteDeadlineUseCase => ({
  execute: (tenantId, deadlineId) => repo.deleteDeadline(tenantId, deadlineId),
});
