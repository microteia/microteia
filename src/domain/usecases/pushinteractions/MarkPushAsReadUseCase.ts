import type { IPushInteractionRepository } from '../../repositories/IPushRepository';

export type MarkPushAsReadUseCase = {
  execute: (userId: string, pushId: string) => Promise<void>;
};

export const makeMarkPushAsReadUseCase = (
  repo: IPushInteractionRepository,
): MarkPushAsReadUseCase => ({
  execute: async (userId, pushId) => {
    await repo.upsertInteraction(userId, pushId, {
      isRead: true,
      readAt: new Date(),
    });
  },
});
