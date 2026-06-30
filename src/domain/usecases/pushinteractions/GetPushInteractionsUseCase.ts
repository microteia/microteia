import type { IPushInteractionRepository } from '../../repositories/IPushRepository';
import type { PushInteraction } from '../../entities';

export type GetPushInteractionsUseCase = {
  execute: (userId: string) => Promise<PushInteraction[]>;
};

export const makeGetPushInteractionsUseCase = (
  repo: IPushInteractionRepository,
): GetPushInteractionsUseCase => ({
  execute: (userId) => repo.getInteractions(userId),
});
