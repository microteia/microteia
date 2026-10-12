import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import type {
  IWorkflowClockRepository,
  WorkflowClockEntry,
  WorkflowClockFireResult,
} from '../../domain/repositories/IWorkflowClockRepository';
import { WORKFLOW_CLOCK_COLLECTION, WORKFLOW_SCHEDULE_EVENT } from '../../domain/schema/workflowClock';
import { workflowEventDocument, workflowEventsRef } from '../services/workflowEventDocument';

const toDate = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : null);

const mapEntry = (tenantId: string, definitionId: string, data: DocumentData): WorkflowClockEntry | null => {
  const nextRunAt = toDate(data.nextRunAt);
  if (!nextRunAt || typeof data.cron !== 'string') return null;
  return {
    tenantId,
    definitionId,
    kind: 'schedule',
    cron: data.cron,
    declaredTimeZone: typeof data.declaredTimeZone === 'string' ? data.declaredTimeZone : null,
    timeZone: typeof data.timeZone === 'string' ? data.timeZone : 'UTC',
    nextRunAt,
  };
};

const fromSnapshot = (snapshot: DocumentSnapshot): WorkflowClockEntry | null => {
  const tenantId = snapshot.ref.parent.parent?.id;
  const data = snapshot.data();
  return tenantId && data ? mapEntry(tenantId, snapshot.id, data) : null;
};

/**
 * O id do evento de uma ocorrência é DETERMINÍSTICO: a automação e o instante previsto. É a segunda
 * trava contra o disparo duplo — a primeira é conferir `nextRunAt` dentro da transação.
 */
const occurrenceEventId = (entry: WorkflowClockEntry): string => `clock_${entry.definitionId}_${entry.nextRunAt.getTime()}`;

export class FirebaseWorkflowClockRepository implements IWorkflowClockRepository {
  constructor(private readonly db: Firestore) {}

  private entryRef(tenantId: string, definitionId: string) {
    return this.db.collection('tenants').doc(tenantId).collection(WORKFLOW_CLOCK_COLLECTION).doc(definitionId);
  }

  async find(tenantId: string, definitionId: string): Promise<WorkflowClockEntry | null> {
    const snapshot = await this.entryRef(tenantId, definitionId).get();
    return snapshot.exists ? mapEntry(tenantId, definitionId, snapshot.data() as DocumentData) : null;
  }

  async save(entry: WorkflowClockEntry): Promise<void> {
    await this.entryRef(entry.tenantId, entry.definitionId).set({
      kind: entry.kind,
      cron: entry.cron,
      declaredTimeZone: entry.declaredTimeZone,
      timeZone: entry.timeZone,
      nextRunAt: Timestamp.fromDate(entry.nextRunAt),
      updatedAt: Timestamp.now(),
    });
  }

  async remove(tenantId: string, definitionId: string): Promise<void> {
    await this.entryRef(tenantId, definitionId).delete();
  }

  async due(now: Date, limit: number): Promise<WorkflowClockEntry[]> {
    const snapshot = await this.db
      .collectionGroup(WORKFLOW_CLOCK_COLLECTION)
      .where('nextRunAt', '<=', Timestamp.fromDate(now))
      .orderBy('nextRunAt', 'asc')
      .limit(limit)
      .get();
    return snapshot.docs.map(fromSnapshot).filter((entry): entry is WorkflowClockEntry => entry !== null);
  }

  async fire(entry: WorkflowClockEntry, payload: Record<string, unknown>, next: Date | null): Promise<WorkflowClockFireResult> {
    const entryRef = this.entryRef(entry.tenantId, entry.definitionId);
    const eventRef = workflowEventsRef(this.db, entry.tenantId).doc(occurrenceEventId(entry));

    return this.db.runTransaction(async (tx) => {
      const [current, existingEvent] = await Promise.all([tx.get(entryRef), tx.get(eventRef)]);
      const stored = current.exists ? toDate(current.get('nextRunAt')) : null;
      if (!stored || stored.getTime() !== entry.nextRunAt.getTime() || existingEvent.exists) return 'stale';

      tx.create(eventRef, workflowEventDocument(WORKFLOW_SCHEDULE_EVENT, payload, { target: entry.definitionId }));
      if (next) {
        tx.update(entryRef, { nextRunAt: Timestamp.fromDate(next), timeZone: entry.timeZone, updatedAt: Timestamp.now() });
      } else {
        tx.delete(entryRef);
      }
      return 'fired';
    });
  }
}
