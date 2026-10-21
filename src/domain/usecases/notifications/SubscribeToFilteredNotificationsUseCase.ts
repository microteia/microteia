import type { InboxNotification, InboxNotificationFilter } from '../../entities/InboxNotification';
import type { INotificationInboxRepository } from '../../repositories/INotificationRepositories';

export type SubscribeToFilteredNotificationsUseCase = {
  execute: (
    tenantId: string,
    userId: string,
    filter: InboxNotificationFilter,
    max: number,
    onChange: (notifications: InboxNotification[]) => void,
    onError: () => void,
  ) => () => void;
};

export const makeSubscribeToFilteredNotificationsUseCase = (
  repo: INotificationInboxRepository,
): SubscribeToFilteredNotificationsUseCase => ({
  execute: (tenantId, userId, filter, max, onChange, onError) =>
    repo.subscribeFiltered(tenantId, userId, filter, max, onChange, onError),
});
