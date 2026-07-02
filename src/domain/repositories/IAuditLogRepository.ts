import type { AuditLog } from '../entities';

export interface AuditLogQuery {
  /** null = todos os escritórios (somente para usuários SYSTEM) */
  tenantId: string | null;
  pageSize: number;
  cursor?: unknown;
}

export interface AuditLogPage {
  logs: AuditLog[];
  nextCursor: unknown;
  hasMore: boolean;
}

export interface IAuditLogRepository {
  getPage(query: AuditLogQuery): Promise<AuditLogPage>;
}
