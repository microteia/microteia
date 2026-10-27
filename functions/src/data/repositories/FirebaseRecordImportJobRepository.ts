import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, DocumentReference, Firestore } from 'firebase-admin/firestore';
import type {
  IRecordImportJobRepository,
  NewRecordImportJob,
  RecordImportJob,
} from '../../domain/repositories/IRecordImportJobRepository';
import { RECORD_IMPORTS_COLLECTION, RECORD_IMPORT_STATUSES, emptyImportTotals } from '../../domain/schema/recordImport';
import type { RecordImportStatus, RecordImportTotals } from '../../domain/schema/recordImport';

const countOf = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const readJob = (id: string, data: DocumentData): RecordImportJob => {
  const totals = (data.totals ?? {}) as Record<string, unknown>;
  const status = RECORD_IMPORT_STATUSES.includes(data.status) ? (data.status as RecordImportStatus) : 'running';
  return {
    id,
    table: String(data.table ?? ''),
    collection: String(data.collection ?? ''),
    fileName: String(data.fileName ?? ''),
    totalRows: countOf(data.totalRows),
    status,
    createdBy: String(data.createdBy ?? ''),
    totals: { created: countOf(totals.created), updated: countOf(totals.updated), failed: countOf(totals.failed) },
  };
};

/**
 * Os jobs em `tenants/{id}/record_imports`. O `expiresAt` é o TTL declarado em `firestore.indexes.json`:
 * o job é andamento, e a prova do que foi importado é o registro e a linha de Auditoria.
 */
export class FirebaseRecordImportJobRepository implements IRecordImportJobRepository {
  constructor(private readonly db: Firestore) {}

  private job(tenantId: string, importId: string): DocumentReference<DocumentData> {
    return this.db.collection(`tenants/${tenantId}/${RECORD_IMPORTS_COLLECTION}`).doc(importId);
  }

  async create(tenantId: string, job: NewRecordImportJob): Promise<string> {
    const reference = this.db.collection(`tenants/${tenantId}/${RECORD_IMPORTS_COLLECTION}`).doc();
    await reference.create({
      table: job.table,
      collection: job.collection,
      fileName: job.fileName,
      totalRows: job.totalRows,
      createdBy: job.createdBy,
      status: 'running',
      totals: emptyImportTotals(),
      startedAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(job.expiresAt),
    });
    return reference.id;
  }

  async get(tenantId: string, importId: string): Promise<RecordImportJob | null> {
    if (!importId) return null;
    const snapshot = await this.job(tenantId, importId).get();
    return snapshot.exists ? readJob(snapshot.id, snapshot.data() as DocumentData) : null;
  }

  async addTotals(tenantId: string, importId: string, totals: RecordImportTotals): Promise<void> {
    await this.job(tenantId, importId).update({
      'totals.created': FieldValue.increment(totals.created),
      'totals.updated': FieldValue.increment(totals.updated),
      'totals.failed': FieldValue.increment(totals.failed),
    });
  }

  async close(
    tenantId: string,
    importId: string,
    status: Exclude<RecordImportStatus, 'running'>,
  ): Promise<RecordImportJob | null> {
    const reference = this.job(tenantId, importId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return null;
      const job = readJob(snapshot.id, snapshot.data() as DocumentData);
      if (job.status !== 'running') return null;
      transaction.update(reference, { status, finishedAt: Timestamp.now() });
      return { ...job, status };
    });
  }
}
