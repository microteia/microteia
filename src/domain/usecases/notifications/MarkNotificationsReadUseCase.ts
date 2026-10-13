import type { INotificationInboxRepository } from '../../repositories/INotificationRepositories';

export type MarkNotificationsReadUseCase = {
  execute: (tenantId: string, ids: readonly string[]) => Promise<void>;
};

export const makeMarkNotificationsReadUseCase = (repo: INotificationInboxRepository): MarkNotificationsReadUseCase => ({
  execute: (tenantId, ids) => (ids.length === 0 ? Promise.resolve() : repo.markRead(tenantId, ids)),
});
