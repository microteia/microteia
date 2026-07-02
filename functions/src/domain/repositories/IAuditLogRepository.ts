import type { AuditLog } from '../entities/AuditLog';

export interface IAuditLogRepository {
  create(log: Omit<AuditLog, 'id' | 'createdAt' | 'expiresAt'>): Promise<void>;
}
