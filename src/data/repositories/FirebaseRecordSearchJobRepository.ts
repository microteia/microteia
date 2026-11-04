import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type { IRecordSearchJobRepository } from '../../domain/repositories/IRecordSearchJobRepository';
import {
  readRecordSearchJobState,
  RECORD_SEARCH_JOBS_COLLECTION,
  recordSearchBackfillJobId,
} from '../../domain/schema/recordSearch';
import type { RecordSearchJobState } from '../../domain/schema/recordSearch';

export class FirebaseRecordSearchJobRepository implements IRecordSearchJobRepository {
  subscribeBackfill(
    tenantId: string,
    collection: string,
    onChange: (state: RecordSearchJobState | null) => void,
  ): () => void {
    return onSnapshot(
      doc(db, 'tenants', tenantId, RECORD_SEARCH_JOBS_COLLECTION, recordSearchBackfillJobId(collection)),
      (snapshot) => onChange(snapshot.exists() ? readRecordSearchJobState(snapshot.data()) : null),
      // A conferência é um conserto em segundo plano: uma leitura recusada não pode derrubar a listagem.
      () => onChange(null),
    );
  }

  async reconcile(tenantId: string): Promise<void> {
    const call = httpsCallable<{ tenantId: string }, { changed: number }>(functions, 'reconcileRecordSearch');
    await call({ tenantId });
  }
}
