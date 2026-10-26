import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { AuditLog } from '../../domain/entities/AuditLog';
import { auditLogExpiresAt } from '../../domain/schema/auditRetention';

export class FirebaseAuditLogRepository implements IAuditLogRepository {
  /**
   * `retentionDaysOf` é a política do escritório (`auditRetention/{tenantId}`), lida com cache — nunca
   * falha: sem documento, ou sem conseguir lê-lo, valem os 30 dias de sempre.
   */
  constructor(
    private readonly db: Firestore,
    private readonly retentionDaysOf: (tenantId: string) => Promise<number>,
  ) {}

  async create(log: Omit<AuditLog, 'id' | 'createdAt' | 'expiresAt'>): Promise<void> {
    const now = Timestamp.now();
    const retentionDays = await this.retentionDaysOf(log.tenantId);

    await this.db.collection('auditLogs').add({
      ...log,
      createdAt: now,
      expiresAt: Timestamp.fromDate(auditLogExpiresAt(now.toDate(), retentionDays)),
    });
  }
}
