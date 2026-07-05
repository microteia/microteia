import type { Deadline } from '../../entities';
import type { IDeadlineRepository } from '../../repositories/IDeadlineRepository';

export type SubscribeToDeadlinesUseCase = {
  execute: (tenantId: string, onUpdate: (deadlines: Deadline[]) => void) => () => void;
};

export const makeSubscribeToDeadlinesUseCase = (repo: IDeadlineRepository): SubscribeToDeadlinesUseCase => ({
  execute: (tenantId, onUpdate) => repo.subscribeToDeadlines(tenantId, onUpdate),
});
