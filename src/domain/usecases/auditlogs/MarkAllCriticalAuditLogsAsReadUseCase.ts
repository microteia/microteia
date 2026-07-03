import type { IAuditLogRepository } from '../../repositories/IAuditLogRepository';
import type { AuditLogReadCursor } from '../../entities';

export type MarkAllCriticalAuditLogsAsReadUseCase = {
  execute: (userId: string, tenantId: string) => Promise<AuditLogReadCursor>;
};

export const makeMarkAllCriticalAuditLogsAsReadUseCase = (
  repo: IAuditLogRepository,
): MarkAllCriticalAuditLogsAsReadUseCase => ({
  execute: (userId, tenantId) => repo.markAllCriticalAsRead(userId, tenantId),
});
