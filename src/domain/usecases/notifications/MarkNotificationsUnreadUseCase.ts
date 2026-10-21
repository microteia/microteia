import type { INotificationInboxRepository } from '../../repositories/INotificationRepositories';

export type MarkNotificationsUnreadUseCase = {
  execute: (tenantId: string, ids: readonly string[]) => Promise<void>;
};

export const makeMarkNotificationsUnreadUseCase = (repo: INotificationInboxRepository): MarkNotificationsUnreadUseCase => ({
  execute: (tenantId, ids) => (ids.length === 0 ? Promise.resolve() : repo.markUnread(tenantId, ids)),
});
