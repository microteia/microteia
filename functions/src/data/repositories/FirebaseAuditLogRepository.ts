import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { AuditLog } from '../../domain/entities/AuditLog';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class FirebaseAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: Firestore) {}

  async create(log: Omit<AuditLog, 'id' | 'createdAt' | 'expiresAt'>): Promise<void> {
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + THIRTY_DAYS_MS);

    await this.db.collection('auditLogs').add({
      ...log,
      createdAt: now,
      expiresAt,
    });
  }
}
