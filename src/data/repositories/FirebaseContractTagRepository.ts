import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IContractTagRepository } from '../../domain/repositories/IContractTagRepository';
import type { ContractTag, DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';

const tagsRef = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'contractTags');

const mapTag = (id: string, d: Record<string, unknown>, tenantId: string): ContractTag => ({
  id,
  tenantId,
  name: d.name as string,
  color: d.color as string,
  createdBy: d.createdBy as string,
  createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : (d.createdAt as Date),
});

export class FirebaseContractTagRepository implements IContractTagRepository {
  async getContractTags(tenantId: string): Promise<ContractTag[]> {
    const q = query(tagsRef(tenantId), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapTag(d.id, d.data(), tenantId));
  }

  async createContractTag(tenantId: string, data: Omit<ContractTag, 'id' | 'tenantId' | 'createdAt'>): Promise<ContractTag> {
    const ref = await addDoc(tagsRef(tenantId), { ...data, createdAt: serverTimestamp() });
    return { id: ref.id, tenantId, ...data, createdAt: new Date() };
  }

  async updateContractTag(tenantId: string, tagId: string, data: { name: string; color: string }): Promise<void> {
    await updateDoc(doc(tagsRef(tenantId), tagId), data);
  }

  async deleteContractTag(tenantId: string, tagId: string, actor: DeletionActor): Promise<void> {
    const ref = doc(tagsRef(tenantId), tagId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }
}
