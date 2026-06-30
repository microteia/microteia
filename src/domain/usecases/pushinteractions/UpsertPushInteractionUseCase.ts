import type { IPushInteractionRepository } from '../../repositories/IPushRepository';
import type { PushInteraction } from '../../entities';

export type UpsertPushInteractionUseCase = {
  execute: (
    userId: string,
    pushId: string,
    data: Partial<Omit<PushInteraction, 'id' | 'userId' | 'pushId' | 'createdAt'>>,
  ) => Promise<PushInteraction>;
};

export const makeUpsertPushInteractionUseCase = (
  repo: IPushInteractionRepository,
): UpsertPushInteractionUseCase => ({
  execute: (userId, pushId, data) => repo.upsertInteraction(userId, pushId, data),
});
