import type { IAuditLogRepository } from '../../repositories/IAuditLogRepository';

export type SubscribeToCriticalUnreadUseCase = {
  execute: (tenantId: string, since: Date, callback: (count: number) => void) => () => void;
};

export const makeSubscribeToCriticalUnreadUseCase = (
  repo: IAuditLogRepository,
): SubscribeToCriticalUnreadUseCase => ({
  execute: (tenantId, since, callback) => repo.subscribeToCriticalUnread(tenantId, since, callback),
});
