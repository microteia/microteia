import type { IAuditLogRepository } from '../../repositories/IAuditLogRepository';
import type { AuditLogReadCursor } from '../../entities';

export type GetAuditLogReadCursorUseCase = {
  execute: (userId: string, tenantId: string) => Promise<AuditLogReadCursor | null>;
};

export const makeGetAuditLogReadCursorUseCase = (repo: IAuditLogRepository): GetAuditLogReadCursorUseCase => ({
  execute: (userId, tenantId) => repo.getReadCursor(userId, tenantId),
});
