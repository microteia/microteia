import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  AuditRetentionAuthor,
  IAuditRetentionRepository,
  StoredAuditRetention,
} from '../../domain/repositories/IAuditRetentionRepository';
import type { AuditArchiveFailure, AuditArchiveState, AuditRetentionPolicy } from '../../domain/schema/auditRetention';
import {
  AUDIT_RETENTION_COLLECTION,
  EMPTY_AUDIT_ARCHIVE_STATE,
  auditRetentionPolicyOf,
} from '../../domain/schema/auditRetention';

const stringOrNull = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

const failureOf = (value: unknown): AuditArchiveFailure | null => {
  if (typeof value !== 'object' || value === null) return null;
  const failure = value as Record<string, unknown>;
  if (typeof failure.day !== 'string') return null;
  return {
    day: failure.day,
    message: String(failure.message ?? ''),
    attempts: typeof failure.attempts === 'number' ? failure.attempts : 1,
    firstFailedAt: String(failure.firstFailedAt ?? ''),
    lastAlertedAt: String(failure.lastAlertedAt ?? ''),
  };
};

const stateOf = (value: unknown): AuditArchiveState => {
  if (typeof value !== 'object' || value === null) return EMPTY_AUDIT_ARCHIVE_STATE;
  const state = value as Record<string, unknown>;
  return {
    startDay: stringOrNull(state.startDay),
    firstDay: stringOrNull(state.firstDay),
    lastDay: stringOrNull(state.lastDay),
    headHash: stringOrNull(state.headHash),
    lastExportedAt: stringOrNull(state.lastExportedAt),
    failure: failureOf(state.failure),
  };
};

const entryOf = (tenantId: string, data: Record<string, unknown> | undefined): StoredAuditRetention => ({
  tenantId,
  policy: auditRetentionPolicyOf(data),
  state: stateOf(data?.state),
});

/** `auditRetention/{tenantId}`. A política fica na raiz do documento, o andamento em `state`. */
export class FirestoreAuditRetentionRepository implements IAuditRetentionRepository {
  constructor(private readonly db: Firestore) {}

  private doc(tenantId: string) {
    return this.db.collection(AUDIT_RETENTION_COLLECTION).doc(tenantId);
  }

  async get(tenantId: string): Promise<StoredAuditRetention> {
    const snapshot = await this.doc(tenantId).get();
    return entryOf(tenantId, snapshot.data());
  }

  async listArchiving(): Promise<StoredAuditRetention[]> {
    const snapshot = await this.db.collection(AUDIT_RETENTION_COLLECTION).where('archive.enabled', '==', true).get();
    return snapshot.docs.map((doc) => entryOf(doc.id, doc.data()));
  }

  async savePolicy(
    tenantId: string,
    policy: AuditRetentionPolicy,
    state: AuditArchiveState,
    author: AuditRetentionAuthor,
  ): Promise<void> {
    await this.doc(tenantId).set({
      tenantId,
      retentionDays: policy.retentionDays,
      archive: policy.archive,
      state,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: author.userId,
      updatedByName: author.userName,
    }, { merge: true });
  }

  async saveState(tenantId: string, state: AuditArchiveState): Promise<void> {
    await this.doc(tenantId).set({ tenantId, state }, { merge: true });
  }
}
