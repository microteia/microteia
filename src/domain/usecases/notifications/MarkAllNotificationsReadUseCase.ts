import type { INotificationInboxRepository } from '../../repositories/INotificationRepositories';

export type MarkAllNotificationsReadUseCase = {
  execute: (tenantId: string, userId: string) => Promise<void>;
};

export const makeMarkAllNotificationsReadUseCase = (
  repo: INotificationInboxRepository,
): MarkAllNotificationsReadUseCase => ({
  execute: (tenantId, userId) => repo.markAllRead(tenantId, userId),
});
