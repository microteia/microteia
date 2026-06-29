import type { Deadline } from '../../entities';
import type { IDeadlineRepository } from '../../repositories/IDeadlineRepository';

export type GetDeadlinesUseCase = {
  execute: (tenantId: string) => Promise<Deadline[]>;
};

export const makeGetDeadlinesUseCase = (repo: IDeadlineRepository): GetDeadlinesUseCase => ({
  execute: (tenantId) => repo.getDeadlines(tenantId),
});
