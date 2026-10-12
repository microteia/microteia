import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import type {
  IRecordKeyAdoptionRepository,
  RecordKeyAdoptionOutcome,
  RecordKeyAdoptionRecord,
  RecordKeyAdoptionRequest,
} from '../../domain/repositories/IRecordKeyAdoptionRepository';
import { RECORD_KEY_ADOPTION_COLLECTION, readRecordKeyAdoptionState } from '../../domain/schema/recordKeyAdoption';
import type { RecordKeyAdoptionState } from '../../domain/schema/recordKeyAdoption';
import { RECORD_KEYS_COLLECTION, RECORD_KEY_REFS_FIELD, storedRecordKeyRefs } from '../../domain/schema/recordKeys';
import { decideRecordKeyAdoption } from '../../domain/services/recordKeyAdoption';
import { normalizeFirestoreValue } from '../../domain/services/normalizeFirestoreValue';

interface ReservationData {
  collection?: string;
  keyName?: string;
  recordId?: string;
}

export class FirebaseRecordKeyAdoptionRepository implements IRecordKeyAdoptionRepository {
  constructor(private readonly db: Firestore) {}

  private jobs(tenantId: string) {
    return this.db.collection(`tenants/${tenantId}/${RECORD_KEY_ADOPTION_COLLECTION}`);
  }

  private reservation(tenantId: string, keyId: string): DocumentReference {
    return this.db.collection(`tenants/${tenantId}/${RECORD_KEYS_COLLECTION}`).doc(keyId);
  }

  async listStates(tenantId: string): Promise<Map<string, RecordKeyAdoptionState>> {
    const snapshot = await this.jobs(tenantId).get();
    return new Map(snapshot.docs.map((doc) => [doc.id, readRecordKeyAdoptionState(doc.data())]));
  }

  async update(
    tenantId: string,
    collection: string,
    mutate: (current: RecordKeyAdoptionState | null) => RecordKeyAdoptionState | null,
  ): Promise<RecordKeyAdoptionState | null> {
    const ref = this.jobs(tenantId).doc(collection);
    return this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const current = snapshot.exists ? readRecordKeyAdoptionState(snapshot.data() ?? {}) : null;
      const next = mutate(current);
      if (next) tx.set(ref, { ...next });
      return next;
    });
  }

  async listRecords(
    tenantId: string,
    collection: string,
    afterId: string | null,
    limit: number,
  ): Promise<RecordKeyAdoptionRecord[]> {
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

  async adoptRecord(
    tenantId: string,
    collection: string,
    recordId: string,
    planFor: (data: Record<string, unknown>) => RecordKeyAdoptionRequest,
  ): Promise<RecordKeyAdoptionOutcome> {
    const recordRef = this.db.collection(`tenants/${tenantId}/${collection}`).doc(recordId);
    return this.db.runTransaction(async (tx) => {
      const record = await tx.get(recordRef);
      if (!record.exists) return { gone: true, reserved: 0, issues: [] };

      const data = normalizeFirestoreValue(record.data() as Record<string, unknown>);
      const stored = storedRecordKeyRefs(data);
      const request = planFor(data);

      const keyIds = [...new Set([
        ...request.plan.entries.map((entry) => entry.keyId),
        ...request.names.flatMap((name) => (stored[name] ? [stored[name]] : [])),
      ])];
      const reservationDocs = keyIds.length > 0
        ? await tx.getAll(...keyIds.map((keyId) => this.reservation(tenantId, keyId)))
        : [];
      const reservations = new Map<string, string | null>();
      const held = new Map<string, ReservationData>();
      reservationDocs.forEach((doc, index) => {
        const reservation = doc.exists ? (doc.data() as ReservationData) : null;
        reservations.set(keyIds[index], reservation?.recordId ?? null);
        if (reservation?.recordId && reservation.recordId !== recordId) held.set(keyIds[index], reservation);
      });

      // O dono só conta se existe e ainda cita a reserva. Uma reserva que ninguém cita é resto de uma
      // gravação interrompida — prendê-la faria de um acidente uma duplicata impossível de resolver.
      const heldIds = [...held.keys()];
      const holderDocs = heldIds.length > 0
        ? await tx.getAll(...heldIds.map((keyId) => {
          const reservation = held.get(keyId) as ReservationData;
          return this.db
            .collection(`tenants/${tenantId}/${reservation.collection ?? collection}`)
            .doc(reservation.recordId as string);
        }))
        : [];
      const liveHolders = new Set<string>();
      holderDocs.forEach((doc, index) => {
        const keyId = heldIds[index];
        const keyName = held.get(keyId)?.keyName ?? '';
        if (doc.exists && storedRecordKeyRefs(doc.data() as Record<string, unknown>)[keyName] === keyId) {
          liveHolders.add(keyId);
        }
      });

      const decision = decideRecordKeyAdoption({ recordId, stored, request, reservations, liveHolders });

      for (const keyId of decision.release) tx.delete(this.reservation(tenantId, keyId));
      for (const entry of decision.create) {
        tx.set(this.reservation(tenantId, entry.keyId), {
          collection,
          keyName: entry.name,
          recordId,
          values: entry.values,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      // Só `keyRefs`, por caminho de campo: nenhum outro campo do registro é regravado, `updatedAt`
      // fica como estava, e um nome de chave com ponto (`field:a.b`) não vira aninhamento.
      const [first, ...rest] = Object.entries(decision.refs).map(([name, keyId]) => [
        new FieldPath(RECORD_KEY_REFS_FIELD, name),
        keyId === null ? FieldValue.delete() : keyId,
      ] as const);
      if (first) tx.update(recordRef, first[0], first[1], ...rest.flat());

      return { gone: false, reserved: decision.create.length, issues: decision.issues };
    });
  }
}
