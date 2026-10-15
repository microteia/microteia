import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IWorkflowClockRepository } from '../../domain/repositories/IWorkflowClockRepository';
import { WORKFLOW_CLOCK_COLLECTION } from '../../domain/schema/workflowClock';
import type { WorkflowClockLastRun, WorkflowClockStatus } from '../../domain/schema/workflowClock';

const toDate = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : null);

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
    skipReason: run.skipReason === 'owners-deactivated' || run.skipReason === 'date-field-missing' ? run.skipReason : null,
    eventId: typeof run.eventId === 'string' ? run.eventId : null,
    records: typeof run.records === 'number' ? run.records : null,
  };
};

const mapStatus = (data: Record<string, unknown>): WorkflowClockStatus | null => {
  const nextRunAt = toDate(data.nextRunAt);
  if (!nextRunAt) return null;
  return {
    nextRunAt,
    timeZone: typeof data.timeZone === 'string' ? data.timeZone : 'UTC',
    updatedAt: toDate(data.updatedAt),
    lastRun: mapLastRun(data.lastRun),
  };
};

export class FirebaseWorkflowClockRepository implements IWorkflowClockRepository {
  subscribeToClockStatus(
    tenantId: string,
    definitionId: string,
    onUpdate: (status: WorkflowClockStatus | null) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      doc(db, 'tenants', tenantId, WORKFLOW_CLOCK_COLLECTION, definitionId),
      (snap) => onUpdate(snap.exists() ? mapStatus(snap.data()) : null),
      (error) => {
        console.error('[WorkflowClockRepository] subscribeToClockStatus:', error.message);
        onError?.(error);
      },
    );
  }
}
