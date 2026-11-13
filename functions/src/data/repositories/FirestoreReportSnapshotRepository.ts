import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import type { IReportSnapshotRepository } from '../../domain/repositories/IReportSnapshotRepository';
import { REPORT_SNAPSHOTS_COLLECTION } from '../../domain/schema/report/reportSnapshot';
import type { ReportSnapshot } from '../../domain/schema/report/reportSnapshot';

const dateOf = (value: unknown): Date =>
  value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : new Date(String(value ?? 0));

/** A foto gravada, lida com desconfiança: o que não tem forma de linha fica de fora. */
const toSnapshot = (id: string, data: DocumentData): ReportSnapshot => ({
  id,
  report: String(data.report ?? ''),
  takenAt: dateOf(data.takenAt),
  definition: String(data.definition ?? ''),
  rows: Array.isArray(data.rows)
    ? data.rows.filter((row: unknown): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    : [],
  totals: typeof data.totals === 'object' && data.totals !== null ? data.totals : {},
  count: typeof data.count === 'number' ? data.count : 0,
  complete: data.complete !== false,
  truncated: data.truncated === true,
  takenBy: typeof data.takenBy === 'string' ? data.takenBy : null,
  expiresAt: dateOf(data.expiresAt),
});

export class FirestoreReportSnapshotRepository implements IReportSnapshotRepository {
  constructor(private readonly db: Firestore) {}

  private collection(tenantId: string) {
    return this.db.collection(`tenants/${tenantId}/${REPORT_SNAPSHOTS_COLLECTION}`);
  }

  async save(tenantId: string, snapshot: Omit<ReportSnapshot, 'id'>): Promise<string> {
    const ref = await this.collection(tenantId).add({
      ...snapshot,
      takenAt: Timestamp.fromDate(snapshot.takenAt),
      expiresAt: Timestamp.fromDate(snapshot.expiresAt),
    });
    return ref.id;
  }

  async series(tenantId: string, reportKey: string, limit: number): Promise<ReportSnapshot[]> {
    const snap = await this.collection(tenantId)
      .where('report', '==', reportKey)
      .orderBy('takenAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((doc) => toSnapshot(doc.id, doc.data())).reverse();
  }
}
