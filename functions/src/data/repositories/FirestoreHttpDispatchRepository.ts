import { FieldValue, Timestamp, type DocumentData, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';
import type {
  HttpDispatchCallbackEvent,
  HttpDispatchInput,
  HttpDispatchRecord,
  HttpDispatchStatus,
  HttpDispatchSummary,
  IHttpDispatchRepository,
} from '../../domain/repositories/IHttpDispatchRepository';
import {
  HTTP_DISPATCH_RETENTION_DAYS,
  HTTP_DISPATCH_UNCLAIMED_MINUTES,
  HTTP_DISPATCHES_COLLECTION,
} from '../../domain/schema/httpRequestSpec';
import { normalizeFirestoreValue } from '../../domain/services/normalizeFirestoreValue';
import { workflowEventDocument, workflowEventsRef } from '../services/workflowEventDocument';
import { WORKFLOW_CALLED_EVENT } from '../../domain/schema/eventCatalog';

const DAY_MS = 24 * 60 * 60 * 1000;
const PENDING: readonly HttpDispatchStatus[] = ['queued', 'sending', 'waiting'];

const unclaimedAt = (now: Date): Timestamp =>
  Timestamp.fromMillis(now.getTime() + HTTP_DISPATCH_UNCLAIMED_MINUTES * 60_000);

const toRecord = (id: string, data: DocumentData): HttpDispatchRecord => {
  const value = normalizeFirestoreValue(data) as Record<string, unknown>;
  return {
    ...(value as unknown as HttpDispatchInput),
    id,
    status: value.status as HttpDispatchStatus,
    attempts: typeof value.attempts === 'number' ? value.attempts : 0,
  };
};

/**
 * `nextAttemptAt` existe em todo estado NÃO final e diz quando olhar de novo: o fim da espera
 * (`waiting`), o fim da reserva (`sending`) ou o prazo para alguém pegar (`queued`). Ao terminar, ele
 * some. É o que deixa `requeueDue` ser UMA consulta — servida pelo índice de campo único de grupo.
 */
export class FirestoreHttpDispatchRepository implements IHttpDispatchRepository {
  constructor(private readonly db: Firestore) {}

  private collection(tenantId: string) {
    return this.db.collection('tenants').doc(tenantId).collection(HTTP_DISPATCHES_COLLECTION);
  }

  async enqueue(tenantId: string, input: HttpDispatchInput, now: Date): Promise<string> {
    const ref = this.collection(tenantId).doc();
    await ref.create({
      ...input,
      status: 'queued' satisfies HttpDispatchStatus,
      attempts: 0,
      nextAttemptAt: unclaimedAt(now),
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromMillis(now.getTime() + HTTP_DISPATCH_RETENTION_DAYS * DAY_MS),
    });
    return ref.id;
  }

  async claim(tenantId: string, id: string, now: Date, leaseUntil: Date): Promise<HttpDispatchRecord | null> {
    const ref = this.collection(tenantId).doc(id);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      if (!snap.exists || !data || data.status !== 'queued') return null;
      const attempts = (typeof data.attempts === 'number' ? data.attempts : 0) + 1;
      tx.update(ref, {
        status: 'sending' satisfies HttpDispatchStatus,
        attempts,
        nextAttemptAt: Timestamp.fromDate(leaseUntil),
        updatedAt: Timestamp.fromDate(now),
      });
      return toRecord(id, { ...data, status: 'sending', attempts });
    });
  }

  /** A reserva continua desta tentativa? Outra entrega pode tê-la tomado depois de vencida. */
  private async ownedUpdate(
    tenantId: string,
    id: string,
    attempt: number,
    write: (tx: Transaction, ref: DocumentReference) => void,
  ): Promise<boolean> {
    const ref = this.collection(tenantId).doc(id);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      if (!data || data.status !== 'sending' || data.attempts !== attempt) return false;
      write(tx, ref);
      return true;
    });
  }

  reschedule(tenantId: string, id: string, attempt: number, retryAt: Date, last: HttpDispatchSummary, now: Date): Promise<boolean> {
    return this.ownedUpdate(tenantId, id, attempt, (tx, ref) => {
      tx.update(ref, {
        status: 'waiting' satisfies HttpDispatchStatus,
        nextAttemptAt: Timestamp.fromDate(retryAt),
        last,
        updatedAt: Timestamp.fromDate(now),
      });
    });
  }

  finish(
    tenantId: string,
    id: string,
    attempt: number,
    final: { status: 'done' | 'failed'; summary: HttpDispatchSummary },
    now: Date,
    callback?: HttpDispatchCallbackEvent,
  ): Promise<boolean> {
    return this.ownedUpdate(tenantId, id, attempt, (tx, ref) => {
      tx.update(ref, {
        status: final.status,
        last: final.summary,
        nextAttemptAt: FieldValue.delete(),
        finishedAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
      if (callback) {
        tx.create(
          workflowEventsRef(this.db, tenantId).doc(),
          workflowEventDocument(WORKFLOW_CALLED_EVENT, callback.payload, callback.actor ? { actor: callback.actor } : {}),
        );
      }
    });
  }

  async requeueDue(now: Date, limit: number): Promise<number> {
    const due = await this.db
      .collectionGroup(HTTP_DISPATCHES_COLLECTION)
      .where('nextAttemptAt', '<=', Timestamp.fromDate(now))
      .orderBy('nextAttemptAt')
      .limit(limit)
      .get();
    let requeued = 0;
    for (const doc of due.docs) {
      const moved = await this.db.runTransaction(async (tx) => {
        const snap = await tx.get(doc.ref);
        const data = snap.data();
        const at = data?.nextAttemptAt as { toMillis?: () => number } | undefined;
        if (!data || !PENDING.includes(data.status) || typeof at?.toMillis !== 'function' || at.toMillis() > now.getTime()) return false;
        // A gravação em `queued` é o que acorda a entrega — inclusive quando já estava em `queued`.
        tx.update(doc.ref, {
          status: 'queued' satisfies HttpDispatchStatus,
          nextAttemptAt: unclaimedAt(now),
          updatedAt: Timestamp.fromDate(now),
        });
        return true;
      });
      if (moved) requeued += 1;
    }
    return requeued;
  }
}
