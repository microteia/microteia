import type { InboxNotification } from '../../entities/InboxNotification';
import type { INotificationInboxRepository } from '../../repositories/INotificationRepositories';

export type SubscribeToNotificationInboxUseCase = {
  execute: (
    tenantId: string,
    userId: string,
    max: number,
    onChange: (notifications: InboxNotification[]) => void,
  ) => () => void;
};

export const makeSubscribeToNotificationInboxUseCase = (
  repo: INotificationInboxRepository,
): SubscribeToNotificationInboxUseCase => ({
  execute: (tenantId, userId, max, onChange) => repo.subscribeRecent(tenantId, userId, max, onChange),
});
