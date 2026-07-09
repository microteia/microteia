import type { Firestore } from 'firebase-admin/firestore';
import type { IWorkflowRecordFetcher } from '../../domain/repositories/IWorkflowRecordFetcher';

export class FirestoreWorkflowRecordFetcher implements IWorkflowRecordFetcher {
  constructor(private readonly db: Firestore) {}

  async fetchByIds(
    tenantId: string,
    collection: string,
    ids: string[],
  ): Promise<Map<string, Record<string, unknown> | null>> {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (uniqueIds.length === 0) return new Map();

    const snapshots = await this.db.getAll(
      ...uniqueIds.map((id) => this.db.doc(`tenants/${tenantId}/${collection}/${id}`)),
    );

    return new Map(
      snapshots.map((snapshot, index) => [
        uniqueIds[index],
        snapshot.exists ? (snapshot.data() as Record<string, unknown>) : null,
      ]),
    );
  }
}
