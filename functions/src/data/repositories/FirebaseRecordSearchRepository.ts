import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import type { DocumentSnapshot, Firestore, Query } from 'firebase-admin/firestore';
import type { CustomFieldOption } from '../../domain/entities/entitySchemas';
import type { IRecordSearchRepository, SearchableRecord } from '../../domain/repositories/IRecordSearchRepository';
import {
  RECORD_SEARCH_FIELD,
  RECORD_SEARCH_JOBS_COLLECTION,
  readRecordSearchJobState,
} from '../../domain/schema/recordSearch';
import type { RecordSearchJobState, RecordSearchScan } from '../../domain/schema/recordSearch';

const NOT_FOUND = 5;
const FAILED_PRECONDITION = 9;

/** `getAll` aceita muitas referências, mas uma página de 200 registros com quatro partes cada não. */
const GET_ALL_CHUNK = 100;

/** O teto do operador `in` do Firestore. */
const IN_CHUNK = 30;

const chunks = <T>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let start = 0; start < items.length; start += size) out.push(items.slice(start, start + size));
  return out;
};

/**
 * A versão do documento como texto, sem perder os nanossegundos: o `Date` cortaria em milissegundos,
 * e a precondição de gravação nunca casaria.
 */
export const encodeRecordVersion = (time: Timestamp | undefined): string =>
  time ? `${time.seconds}:${time.nanoseconds}` : '';

const decodeRecordVersion = (version: string): Timestamp | null => {
  const [seconds, nanoseconds] = version.split(':').map(Number);
  return Number.isInteger(seconds) && Number.isInteger(nanoseconds) ? new Timestamp(seconds, nanoseconds) : null;
};

const toRecord = (doc: DocumentSnapshot): SearchableRecord => ({
  id: doc.id,
  data: (doc.data() ?? {}) as Record<string, unknown>,
  version: encodeRecordVersion(doc.updateTime),
});

const errorCode = (error: unknown): number | string | undefined => (error as { code?: number | string } | null)?.code;

export class FirebaseRecordSearchRepository implements IRecordSearchRepository {
  constructor(private readonly db: Firestore) {}

  private collection(tenantId: string, collection: string) {
    return this.db.collection(`tenants/${tenantId}/${collection}`);
  }

  private jobs(tenantId: string) {
    return this.collection(tenantId, RECORD_SEARCH_JOBS_COLLECTION);
  }

  async getRecords(tenantId: string, collection: string, ids: readonly string[]): Promise<Map<string, Record<string, unknown>>> {
    const found = new Map<string, Record<string, unknown>>();
    const ref = this.collection(tenantId, collection);
    for (const part of chunks([...new Set(ids)], GET_ALL_CHUNK)) {
      const snapshots = await this.db.getAll(...part.map((id) => ref.doc(id)));
      for (const snapshot of snapshots) {
        if (snapshot.exists) found.set(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
      }
    }
    return found;
  }

  async getLookupOptions(tenantId: string, lookupCollection: string, keys: readonly string[]): Promise<CustomFieldOption[]> {
    const options: CustomFieldOption[] = [];
    for (const part of chunks([...new Set(keys)], IN_CHUNK)) {
      const snapshot = await this.collection(tenantId, lookupCollection).where('key', 'in', part).get();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (typeof data.key === 'string' && typeof data.label === 'string') options.push({ key: data.key, label: data.label });
      }
    }
    return options;
  }

  async writeTerms(tenantId: string, collection: string, record: SearchableRecord, terms: string[]): Promise<boolean> {
    const version = decodeRecordVersion(record.version);
    const ref = this.collection(tenantId, collection).doc(record.id);
    try {
      // `update`, e não `set` com merge: o registro apagado entre a leitura e esta gravação renasceria
      // como um documento só com os termos.
      if (version) await ref.update({ [RECORD_SEARCH_FIELD]: terms }, { lastUpdateTime: version });
      else await ref.update({ [RECORD_SEARCH_FIELD]: terms });
      return true;
    } catch (error) {
      const code = errorCode(error);
      if (code === NOT_FOUND || code === 'not-found' || code === FAILED_PRECONDITION || code === 'failed-precondition') {
        return false;
      }
      throw error;
    }
  }

  async scanPage(tenantId: string, scan: RecordSearchScan, afterId: string | null, limit: number): Promise<SearchableRecord[]> {
    let query: Query = this.collection(tenantId, scan.collection);
    // Igualdade (ou `array-contains`) no campo e ordem por id: os dois são servidos pelos índices de
    // campo único que o Firestore cria sozinho — nenhuma tela precisa declarar índice para propagar.
    if (scan.fieldKey && scan.value !== null) {
      query = query.where(scan.fieldKey, scan.multi ? 'array-contains' : '==', scan.value);
    }
    query = query.orderBy(FieldPath.documentId()).limit(limit);
    if (afterId) query = query.startAfter(afterId);
    const snapshot = await query.get();
    return snapshot.docs.map(toRecord);
  }

  async getJob(tenantId: string, jobId: string): Promise<RecordSearchJobState | null> {
    const snapshot = await this.jobs(tenantId).doc(jobId).get();
    return snapshot.exists ? readRecordSearchJobState(snapshot.data() ?? {}) : null;
  }

  async listJobs(tenantId: string): Promise<Map<string, RecordSearchJobState>> {
    const snapshot = await this.jobs(tenantId).get();
    return new Map(snapshot.docs.map((doc) => [doc.id, readRecordSearchJobState(doc.data())]));
  }

  async updateJob(
    tenantId: string,
    jobId: string,
    mutate: (current: RecordSearchJobState | null) => RecordSearchJobState | 'delete' | null,
  ): Promise<RecordSearchJobState | null> {
    const ref = this.jobs(tenantId).doc(jobId);
    return this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const current = snapshot.exists ? readRecordSearchJobState(snapshot.data() ?? {}) : null;
      const next = mutate(current);
      if (next === 'delete') {
        if (snapshot.exists) tx.delete(ref);
        return null;
      }
      if (next) tx.set(ref, { ...next, scans: next.scans.map((scan) => ({ ...scan })) });
      return next;
    });
  }
}
