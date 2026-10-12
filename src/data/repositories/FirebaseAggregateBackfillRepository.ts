import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type { IAggregateBackfillRepository } from '../../domain/repositories/IAggregateBackfillRepository';
import {
  AGGREGATE_BACKFILL_COLLECTION,
  readAggregateBackfillState,
} from '../../domain/schema/aggregateBackfill';
import type { AggregateBackfillState } from '../../domain/schema/aggregateBackfill';

export class FirebaseAggregateBackfillRepository implements IAggregateBackfillRepository {
  subscribe(
    tenantId: string,
    table: string,
    onChange: (state: AggregateBackfillState | null) => void,
  ): () => void {
    return onSnapshot(
      doc(db, 'tenants', tenantId, AGGREGATE_BACKFILL_COLLECTION, table),
      (snapshot) => onChange(snapshot.exists() ? readAggregateBackfillState(snapshot.data()) : null),
      // O documento existe para AVISAR: uma leitura recusada não pode derrubar a listagem.
      () => onChange(null),
    );
  }

  async reconcile(tenantId: string): Promise<void> {
    const call = httpsCallable<{ tenantId: string }, { changed: number }>(functions, 'reconcileAggregates');
    await call({ tenantId });
  }
}
