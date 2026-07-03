import type { AuditLog, AuditLogReadCursor } from '../entities';

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
  getReadCursor(userId: string, tenantId: string): Promise<AuditLogReadCursor | null>;
  markAllCriticalAsRead(userId: string, tenantId: string): Promise<AuditLogReadCursor>;
  subscribeToCriticalUnread(tenantId: string, since: Date, callback: (count: number) => void): () => void;
}
