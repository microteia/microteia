import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type { IRecordKeyAdoptionRepository } from '../../domain/repositories/IRecordKeyAdoptionRepository';
import {
  RECORD_KEY_ADOPTION_COLLECTION,
  readRecordKeyAdoptionState,
} from '../../domain/schema/recordKeyAdoption';
import type { RecordKeyAdoptionState } from '../../domain/schema/recordKeyAdoption';

export class FirebaseRecordKeyAdoptionRepository implements IRecordKeyAdoptionRepository {
  subscribe(
    tenantId: string,
    collection: string,
    onChange: (state: RecordKeyAdoptionState | null) => void,
  ): () => void {
    return onSnapshot(
      doc(db, 'tenants', tenantId, RECORD_KEY_ADOPTION_COLLECTION, collection),
      (snapshot) => onChange(snapshot.exists() ? readRecordKeyAdoptionState(snapshot.data()) : null),
      // O documento existe para AVISAR: uma leitura recusada não pode derrubar a listagem.
      () => onChange(null),
    );
  }

  async reconcile(tenantId: string): Promise<void> {
    const call = httpsCallable<{ tenantId: string }, { changed: number }>(functions, 'reconcileRecordKeys');
    await call({ tenantId });
  }
}
