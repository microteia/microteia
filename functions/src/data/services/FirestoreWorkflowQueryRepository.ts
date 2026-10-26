import type { DocumentData, Firestore, Query } from 'firebase-admin/firestore';
import { FieldPath } from 'firebase-admin/firestore';
import type {
  IWorkflowQueryRepository,
  WorkflowEqualityFilter,
  WorkflowQueryRow,
} from '../../domain/repositories/IWorkflowQueryRepository';
import { normalizeFirestoreValue } from '../../domain/services/normalizeFirestoreValue';

const toFieldPath = (path: string): string | FieldPath => {
  const segments = path.split('.').filter(Boolean);
  return segments.length > 1 ? new FieldPath(...segments) : path;
};

export class FirestoreWorkflowQueryRepository implements IWorkflowQueryRepository {
  constructor(private readonly db: Firestore) {}

  async queryByEquality(
    tenantId: string,
    collection: string,
    equalityFilters: WorkflowEqualityFilter[],
    limit: number,
  ): Promise<WorkflowQueryRow[]> {
    let query: Query<DocumentData> = this.db.collection(`tenants/${tenantId}/${collection}`);

    for (const filter of equalityFilters) {
      query = query.where(toFieldPath(filter.path), filter.op ?? '==', filter.value);
    }

    const snapshot = await query.limit(limit).get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      data: normalizeFirestoreValue(doc.data() as Record<string, unknown>),
    }));
  }
}
