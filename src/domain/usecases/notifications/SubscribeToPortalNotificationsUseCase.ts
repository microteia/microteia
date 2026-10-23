import type { InboxNotification } from '../../entities/InboxNotification';
import type { INotificationInboxRepository } from '../../repositories/INotificationRepositories';

export type SubscribeToPortalNotificationsUseCase = {
  execute: (
    tenantId: string,
    userId: string,
    max: number,
    onChange: (notifications: InboxNotification[]) => void,
  ) => () => void;
};

export const makeSubscribeToPortalNotificationsUseCase = (
  repo: INotificationInboxRepository,
): SubscribeToPortalNotificationsUseCase => ({
  execute: (tenantId, userId, max, onChange) => repo.subscribePortal(tenantId, userId, max, onChange),
});
