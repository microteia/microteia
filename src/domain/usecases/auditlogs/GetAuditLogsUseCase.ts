import type { AuditLogQuery, AuditLogPage, IAuditLogRepository } from '../../repositories/IAuditLogRepository';

export type GetAuditLogsUseCase = {
  execute: (query: AuditLogQuery) => Promise<AuditLogPage>;
};

export const makeGetAuditLogsUseCase = (repo: IAuditLogRepository): GetAuditLogsUseCase => ({
  execute: (query) => repo.getPage(query),
});
