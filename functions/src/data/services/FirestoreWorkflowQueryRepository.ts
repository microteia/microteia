import type { DocumentData, Firestore, Query } from 'firebase-admin/firestore';
import { AggregateField, FieldPath } from 'firebase-admin/firestore';
import type {
  IWorkflowQueryRepository,
  WorkflowAggregateMeasure,
  WorkflowAggregateResult,
  WorkflowEqualityFilter,
  WorkflowQueryPage,
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
    page?: WorkflowQueryPage,
  ): Promise<WorkflowQueryRow[]> {
    let query: Query<DocumentData> = this.db.collection(`tenants/${tenantId}/${collection}`);

    for (const filter of equalityFilters) {
      query = query.where(toFieldPath(filter.path), filter.op ?? '==', filter.value);
    }

    if (page) {
      query = query.orderBy(FieldPath.documentId());
      if (page.after !== undefined) query = query.startAfter(page.after);
    }

    const snapshot = await query.limit(limit).get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      data: normalizeFirestoreValue(doc.data() as Record<string, unknown>),
    }));
  }

  async aggregateByEquality(
    tenantId: string,
    collection: string,
    equalityFilters: WorkflowEqualityFilter[],
    measures: WorkflowAggregateMeasure[],
  ): Promise<WorkflowAggregateResult> {
    let query: Query<DocumentData> = this.db.collection(`tenants/${tenantId}/${collection}`);
    for (const filter of equalityFilters) {
      query = query.where(toFieldPath(filter.path), filter.op ?? '==', filter.value);
    }
    // Apelidos posicionais: a chave de uma medida é do autor, e o apelido de uma agregação tem regras
    // de nome que ela não precisa conhecer.
    const fields = Object.fromEntries([
      ['records', AggregateField.count()],
      ...measures.flatMap((measure, index) => {
        if (measure.op === 'count' || !measure.path) return [];
        const field = toFieldPath(measure.path);
        return [[`m${index}`, measure.op === 'sum' ? AggregateField.sum(field) : AggregateField.average(field)]];
      }),
    ]);
    const data = (await query.aggregate(fields).get()).data() as Record<string, number | null>;
    const count = Number(data.records ?? 0);
    return {
      count,
      values: Object.fromEntries(measures.map((measure, index) => [
        measure.key,
        measure.op === 'count' ? count : (data[`m${index}`] ?? null),
      ])),
    };
  }
}
