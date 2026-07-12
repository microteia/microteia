import { Timestamp } from 'firebase-admin/firestore';
import type { CollectionReference, DocumentData, Firestore } from 'firebase-admin/firestore';
import type { IWorkflowMutationRepository } from '../../domain/repositories/IWorkflowMutationRepository';
import { normalizeFirestoreValue } from '../../domain/services/normalizeFirestoreValue';

export class FirestoreWorkflowMutationRepository implements IWorkflowMutationRepository {
  constructor(private readonly db: Firestore) {}

  private collection(tenantId: string, collection: string): CollectionReference<DocumentData> {
    return this.db.collection(`tenants/${tenantId}/${collection}`);
  }

  async getById(
    tenantId: string,
    collection: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const snapshot = await this.collection(tenantId, collection).doc(id).get();
    return snapshot.exists ? normalizeFirestoreValue(snapshot.data() as Record<string, unknown>) : null;
  }

  async create(
    tenantId: string,
    collection: string,
    data: Record<string, unknown>,
    id?: string,
  ): Promise<string> {
    const now = Timestamp.now();
    const payload = { ...data, createdAt: now, updatedAt: now };
    if (id) {
      await this.collection(tenantId, collection).doc(id).set(payload);
      return id;
    }
    const ref = await this.collection(tenantId, collection).add(payload);
    return ref.id;
  }

  async update(
    tenantId: string,
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.collection(tenantId, collection)
      .doc(id)
      .set({ ...data, updatedAt: Timestamp.now() }, { merge: true });
  }

  async delete(tenantId: string, collection: string, id: string): Promise<void> {
    await this.collection(tenantId, collection).doc(id).delete();
  }
}
