import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import type {
  ClaimedEvent,
  ClockAdvance,
  DateReachedPage,
  DatedRecord,
  IWorkflowClockRepository,
  ResumeClockEntry,
  ScheduleClockEntry,
  WorkflowClockEntry,
  WorkflowClockFireResult,
} from '../../domain/repositories/IWorkflowClockRepository';
import { normalizeFirestoreValue } from '../../domain/services/normalizeFirestoreValue';
import type { WorkflowClockLastRun } from '../../domain/schema/workflowClock';
import {
  RESUME_CLOCK_ID_PREFIX,
  clockOccurrenceEventId,
  WORKFLOW_CLOCK_COLLECTION,
  WORKFLOW_SCHEDULE_EVENT,
  WORKFLOW_TRIGGER_MARKS_COLLECTION,
} from '../../domain/schema/workflowClock';
import { workflowEventDocument, workflowEventsRef } from '../services/workflowEventDocument';

const toDate = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : null);

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string') : [];

const mapPage = (value: unknown): DateReachedPage | null => {
  if (!value || typeof value !== 'object') return null;
  const page = value as Record<string, unknown>;
  const afterValue = toDate(page.afterValue);
  if (!afterValue || typeof page.fromDay !== 'string' || typeof page.toDay !== 'string' || typeof page.afterId !== 'string') {
    return null;
  }
  return { fromDay: page.fromDay, toDay: page.toDay, afterValue, afterId: page.afterId };
};

const SKIP_REASONS: ReadonlySet<string> = new Set(['owners-deactivated', 'date-field-missing']);

const mapLastRun = (value: unknown): WorkflowClockLastRun | null => {
  if (!value || typeof value !== 'object') return null;
  const run = value as Record<string, unknown>;
  const scheduledFor = toDate(run.scheduledFor);
  const ranAt = toDate(run.ranAt);
  if (!scheduledFor || !ranAt || (run.outcome !== 'fired' && run.outcome !== 'skipped')) return null;
  return {
    scheduledFor,
    ranAt,
    outcome: run.outcome,
    skipReason: typeof run.skipReason === 'string' && SKIP_REASONS.has(run.skipReason)
      ? (run.skipReason as WorkflowClockLastRun['skipReason'])
      : null,
    eventId: typeof run.eventId === 'string' ? run.eventId : null,
    records: typeof run.records === 'number' ? run.records : null,
  };
};

const lastRunDocument = (run: WorkflowClockLastRun | null | undefined): DocumentData | null =>
  run ? { ...run, scheduledFor: Timestamp.fromDate(run.scheduledFor), ranAt: Timestamp.fromDate(run.ranAt) } : null;

const mapEntry = (tenantId: string, definitionId: string, data: DocumentData): WorkflowClockEntry | null => {
  const nextRunAt = toDate(data.nextRunAt);
  if (!nextRunAt) return null;
  const base = {
    tenantId,
    definitionId,
    declaredTimeZone: typeof data.declaredTimeZone === 'string' ? data.declaredTimeZone : null,
    timeZone: typeof data.timeZone === 'string' ? data.timeZone : 'UTC',
    nextRunAt,
    ownerPluginIds: stringList(data.ownerPluginIds),
    lastRun: mapLastRun(data.lastRun),
  };
  if (data.kind === 'resume') {
    const event = data.event && typeof data.event === 'object' ? (data.event as Record<string, unknown>) : null;
    if (typeof data.executionId !== 'string' || typeof data.afterStepId !== 'string' || !event || typeof event.id !== 'string' || typeof event.name !== 'string') {
      return null;
    }
    return {
      ...base,
      definitionId: typeof data.definitionId === 'string' ? data.definitionId : definitionId,
      kind: 'resume',
      executionId: data.executionId,
      afterStepId: data.afterStepId,
      lastStepId: typeof data.lastStepId === 'string' ? data.lastStepId : null,
      event: {
        id: event.id,
        name: event.name,
        payload: normalizeFirestoreValue((event.payload ?? {}) as Record<string, unknown>),
        timestamp: toDate(event.timestamp) ?? nextRunAt,
      },
      outputs: normalizeFirestoreValue((data.outputs ?? {}) as Record<string, Record<string, unknown>>),
      variables: normalizeFirestoreValue((data.variables ?? {}) as Record<string, unknown>),
      actor: data.actor && typeof data.actor === 'object' ? (data.actor as ResumeClockEntry['actor']) : null,
      ...(typeof data.taskId === 'string' ? { taskId: data.taskId } : {}),
      ...(data.decided === true ? { decided: true } : {}),
    };
  }
  if (data.kind === 'dateReached') {
    if (
      typeof data.eventName !== 'string' || typeof data.field !== 'string'
      || typeof data.offsetDays !== 'number' || typeof data.at !== 'string' || typeof data.cursorDay !== 'string'
    ) {
      return null;
    }
    return {
      ...base,
      kind: 'dateReached',
      eventName: data.eventName,
      field: data.field,
      offsetDays: data.offsetDays,
      at: data.at,
      cursorDay: data.cursorDay,
      page: mapPage(data.page),
    };
  }
  return typeof data.cron === 'string' ? { ...base, kind: 'schedule', cron: data.cron } : null;
};

const fromSnapshot = (snapshot: DocumentSnapshot): WorkflowClockEntry | null => {
  const tenantId = snapshot.ref.parent.parent?.id;
  const data = snapshot.data();
  return tenantId && data ? mapEntry(tenantId, snapshot.id, data) : null;
};

const pageDocument = (page: DateReachedPage | null): DocumentData | null =>
  page ? { ...page, afterValue: Timestamp.fromDate(page.afterValue) } : null;

const entryDocument = (entry: WorkflowClockEntry): DocumentData => {
  const base = {
    kind: entry.kind,
    declaredTimeZone: entry.declaredTimeZone,
    timeZone: entry.timeZone,
    nextRunAt: Timestamp.fromDate(entry.nextRunAt),
    ownerPluginIds: entry.ownerPluginIds,
    lastRun: lastRunDocument(entry.lastRun),
    updatedAt: Timestamp.now(),
  };
  if (entry.kind === 'schedule') return { ...base, cron: entry.cron };
  if (entry.kind === 'resume') {
    return {
      ...base,
      definitionId: entry.definitionId,
      executionId: entry.executionId,
      afterStepId: entry.afterStepId,
      lastStepId: entry.lastStepId,
      event: { ...entry.event, timestamp: Timestamp.fromDate(entry.event.timestamp) },
      outputs: entry.outputs,
      variables: entry.variables,
      actor: entry.actor,
      ...(entry.taskId ? { taskId: entry.taskId } : {}),
      ...(entry.decided ? { decided: true } : {}),
    };
  }
  return {
    ...base,
    eventName: entry.eventName,
    field: entry.field,
    offsetDays: entry.offsetDays,
    at: entry.at,
    cursorDay: entry.cursorDay,
    page: pageDocument(entry.page),
  };
};

const pageKey = (data: DocumentData | undefined): string | null => {
  const page = data ? mapPage(data.page) : null;
  return page ? `${page.fromDay}|${page.afterId}` : null;
};

/** O código gRPC de "documento já existe" — o `create` da marca perdeu a corrida, e isso não é erro. */
const ALREADY_EXISTS = 6;

export class FirebaseWorkflowClockRepository implements IWorkflowClockRepository {
  constructor(private readonly db: Firestore) {}

  private entryRef(tenantId: string, clockId: string) {
    return this.db.collection('tenants').doc(tenantId).collection(WORKFLOW_CLOCK_COLLECTION).doc(clockId);
  }

  /** O documento da entrada: o da definição, para os gatilhos; o da execução, para a retomada. */
  private refOf(entry: WorkflowClockEntry) {
    return this.entryRef(entry.tenantId, entry.kind === 'resume' ? `${RESUME_CLOCK_ID_PREFIX}${entry.executionId}` : entry.definitionId);
  }

  async find(tenantId: string, definitionId: string): Promise<WorkflowClockEntry | null> {
    const snapshot = await this.entryRef(tenantId, definitionId).get();
    return snapshot.exists ? mapEntry(tenantId, definitionId, snapshot.data() as DocumentData) : null;
  }

  async save(entry: WorkflowClockEntry): Promise<void> {
    await this.refOf(entry).set(entryDocument(entry));
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

  async fire(
    entry: ScheduleClockEntry,
    payload: Record<string, unknown>,
    next: Date | null,
    lastRun: WorkflowClockLastRun,
  ): Promise<WorkflowClockFireResult> {
    const entryRef = this.entryRef(entry.tenantId, entry.definitionId);
    const eventRef = workflowEventsRef(this.db, entry.tenantId).doc(clockOccurrenceEventId(entry.definitionId, entry.nextRunAt));

    return this.db.runTransaction(async (tx) => {
      const [current, existingEvent] = await Promise.all([tx.get(entryRef), tx.get(eventRef)]);
      const stored = current.exists ? toDate(current.get('nextRunAt')) : null;
      if (!stored || stored.getTime() !== entry.nextRunAt.getTime() || existingEvent.exists) return 'stale';

      tx.create(eventRef, workflowEventDocument(WORKFLOW_SCHEDULE_EVENT, payload, { target: entry.definitionId }));
      if (next) {
        tx.update(entryRef, {
          nextRunAt: Timestamp.fromDate(next),
          timeZone: entry.timeZone,
          lastRun: lastRunDocument(lastRun),
          updatedAt: Timestamp.now(),
        });
      } else {
        tx.delete(entryRef);
      }
      return 'fired';
    });
  }

  async claim(entry: ResumeClockEntry): Promise<WorkflowClockFireResult> {
    const entryRef = this.refOf(entry);
    return this.db.runTransaction(async (tx) => {
      const current = await tx.get(entryRef);
      const stored = current.exists ? toDate(current.get('nextRunAt')) : null;
      if (!stored || stored.getTime() !== entry.nextRunAt.getTime()) return 'stale';
      tx.delete(entryRef);
      return 'fired';
    });
  }

  async annotateResume(
    entry: ResumeClockEntry,
    outputs: Record<string, Record<string, unknown>>,
  ): Promise<WorkflowClockFireResult> {
    const entryRef = this.refOf(entry);
    return this.db.runTransaction(async (tx) => {
      const current = await tx.get(entryRef);
      const stored = current.exists ? toDate(current.get('nextRunAt')) : null;
      if (!stored || stored.getTime() !== entry.nextRunAt.getTime() || current.get('decided') === true) return 'stale';
      tx.update(entryRef, { outputs, decided: true, updatedAt: Timestamp.now() });
      return 'fired';
    });
  }

  async advance(entry: WorkflowClockEntry, patch: ClockAdvance): Promise<WorkflowClockFireResult> {
    const entryRef = this.refOf(entry);
    const expectedPage = entry.kind === 'dateReached' && entry.page ? `${entry.page.fromDay}|${entry.page.afterId}` : null;

    return this.db.runTransaction(async (tx) => {
      const current = await tx.get(entryRef);
      const stored = current.exists ? toDate(current.get('nextRunAt')) : null;
      if (!stored || stored.getTime() !== entry.nextRunAt.getTime() || pageKey(current.data()) !== expectedPage) return 'stale';

      tx.update(entryRef, {
        nextRunAt: Timestamp.fromDate(patch.nextRunAt),
        timeZone: patch.timeZone,
        ...(patch.cursorDay !== undefined ? { cursorDay: patch.cursorDay } : {}),
        ...(patch.page !== undefined ? { page: pageDocument(patch.page) } : {}),
        ...(patch.lastRun !== undefined ? { lastRun: lastRunDocument(patch.lastRun) } : {}),
        updatedAt: Timestamp.now(),
      });
      return 'fired';
    });
  }

  async recordsInRange(
    tenantId: string,
    collection: string,
    field: string,
    from: Date,
    to: Date,
    after: { value: Date; id: string } | null,
    limit: number,
  ): Promise<DatedRecord[]> {
    let query = this.db
      .collection('tenants')
      .doc(tenantId)
      .collection(collection)
      .where(field, '>=', Timestamp.fromDate(from))
      .where(field, '<', Timestamp.fromDate(to))
      .orderBy(field, 'asc')
      .orderBy(FieldPath.documentId(), 'asc');
    if (after) query = query.startAfter(Timestamp.fromDate(after.value), after.id);

    const snapshot = await query.limit(limit).get();
    return snapshot.docs.flatMap((doc) => {
      const value = toDate(doc.get(field));
      return value ? [{ id: doc.id, value, data: doc.data() }] : [];
    });
  }

  async claimAndPublish(tenantId: string, markId: string, expiresAt: Date, event: ClaimedEvent): Promise<boolean> {
    const markRef = this.db.collection('tenants').doc(tenantId).collection(WORKFLOW_TRIGGER_MARKS_COLLECTION).doc(markId);
    const batch = this.db.batch();
    batch.create(markRef, { definitionId: event.target, expiresAt: Timestamp.fromDate(expiresAt), createdAt: Timestamp.now() });
    batch.create(workflowEventsRef(this.db, tenantId).doc(), workflowEventDocument(event.name, event.payload, { target: event.target }));
    try {
      await batch.commit();
      return true;
    } catch (error) {
      if ((error as { code?: unknown }).code === ALREADY_EXISTS) return false;
      throw error;
    }
  }
}
