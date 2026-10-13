import type { INotificationInboxRepository } from '../../repositories/INotificationRepositories';

export type SubscribeToUnreadNotificationsUseCase = {
  execute: (tenantId: string, userId: string, cap: number, onChange: (count: number) => void) => () => void;
};

export const makeSubscribeToUnreadNotificationsUseCase = (
  repo: INotificationInboxRepository,
): SubscribeToUnreadNotificationsUseCase => ({
  execute: (tenantId, userId, cap, onChange) => repo.subscribeUnreadCount(tenantId, userId, cap, onChange),
});
