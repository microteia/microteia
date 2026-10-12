import { FieldPath } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  AggregateBackfillParent,
  IAggregateBackfillRepository,
} from '../../domain/repositories/IAggregateBackfillRepository';
import {
  AGGREGATE_BACKFILL_COLLECTION,
  AGGREGATE_BACKFILL_VIA,
  AGGREGATE_ENGINE_ACTOR,
  readAggregateBackfillState,
} from '../../domain/schema/aggregateBackfill';
import type { AggregateBackfillState } from '../../domain/schema/aggregateBackfill';
import { normalizeFirestoreValue } from '../../domain/services/normalizeFirestoreValue';

const NOT_FOUND = 5;

export class FirebaseAggregateBackfillRepository implements IAggregateBackfillRepository {
  constructor(private readonly db: Firestore) {}

  private jobs(tenantId: string) {
    return this.db.collection(`tenants/${tenantId}/${AGGREGATE_BACKFILL_COLLECTION}`);
  }

  async listStates(tenantId: string): Promise<Map<string, AggregateBackfillState>> {
    const snapshot = await this.jobs(tenantId).get();
    return new Map(snapshot.docs.map((doc) => [doc.id, readAggregateBackfillState(doc.data())]));
  }

  async update(
    tenantId: string,
    table: string,
    mutate: (current: AggregateBackfillState | null) => AggregateBackfillState | null,
  ): Promise<AggregateBackfillState | null> {
    const ref = this.jobs(tenantId).doc(table);
    return this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const current = snapshot.exists ? readAggregateBackfillState(snapshot.data() ?? {}) : null;
      const next = mutate(current);
      if (next) tx.set(ref, { ...next });
      return next;
    });
  }

  async listParents(
    tenantId: string,
    collection: string,
    afterId: string | null,
    limit: number,
  ): Promise<AggregateBackfillParent[]> {
    let query = this.db
      .collection(`tenants/${tenantId}/${collection}`)
      .orderBy(FieldPath.documentId())
      .limit(limit);
    if (afterId) query = query.startAfter(afterId);
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      data: normalizeFirestoreValue(doc.data() as Record<string, unknown>),
    }));
  }

  async writeParent(
    tenantId: string,
    collection: string,
    id: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    // `update`, e não `set` com merge: o pai apagado entre a leitura da página e esta gravação
    // renasceria como um documento só com os campos agregados.
    try {
      await this.db.collection(`tenants/${tenantId}/${collection}`).doc(id).update({
        ...payload,
        updatedBy: AGGREGATE_ENGINE_ACTOR,
        updatedVia: AGGREGATE_BACKFILL_VIA,
      });
    } catch (error) {
      const code = (error as { code?: number | string } | null)?.code;
      if (code === NOT_FOUND || code === 'not-found') return;
      throw error;
    }
  }
}
