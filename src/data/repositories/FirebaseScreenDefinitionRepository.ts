import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IScreenDefinitionRepository, ScreenDefinitionInput } from '../../domain/repositories/IScreenDefinitionRepository';
import type { ScreenTag, DeletionActor, ScreenDefinition } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';
import { mapScreenDefinition } from './screenDefinitionMapper';


const definitionsRef = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'screenDefinitions');

const tagsRef = (tenantId: string, screenKey: string) =>
  collection(db, 'tenants', tenantId, 'screenDefinitions', screenKey, 'tags');


const mapTag = (id: string, d: Record<string, unknown>, tenantId: string, screenKey: string): ScreenTag => ({
  id,
  tenantId,
  screenKey,
  name: d.name as string,
  color: d.color as string,
  createdBy: d.createdBy as string,
  createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : (d.createdAt as Date),
});

export class FirebaseScreenDefinitionRepository implements IScreenDefinitionRepository {
  async getAll(tenantId: string): Promise<ScreenDefinition[]> {
    const snap = await getDocs(query(definitionsRef(tenantId), orderBy('sidebarOrder', 'asc')));
    return snap.docs.map((d) => mapScreenDefinition(d.id, d.data(), tenantId));
  }

  async upsert(tenantId: string, screenKey: string, data: ScreenDefinitionInput): Promise<ScreenDefinition> {
    const ref = doc(definitionsRef(tenantId), screenKey);
    // O Firestore rejeita `undefined`, e um campo opcional ausente chega assim. Ausente some;
    // para limpar um valor gravado, use `null`.
    data = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ) as ScreenDefinitionInput;
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const updatable: Partial<ScreenDefinitionInput> = { ...data };
      delete updatable.createdBy;
      await updateDoc(ref, { ...updatable, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    const snap = await getDoc(ref);
    return mapScreenDefinition(ref.id, snap.data() as Record<string, unknown>, tenantId);
  }

  async delete(tenantId: string, screenKey: string, actor: DeletionActor): Promise<void> {
    const tagsSnap = await getDocs(tagsRef(tenantId, screenKey));
    await Promise.all(tagsSnap.docs.map((d) => deleteDoc(d.ref)));
    const ref = doc(definitionsRef(tenantId), screenKey);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }

  async getTags(tenantId: string, screenKey: string): Promise<ScreenTag[]> {
    const q = query(tagsRef(tenantId, screenKey), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapTag(d.id, d.data(), tenantId, screenKey));
  }

  async createTag(tenantId: string, screenKey: string, data: Omit<ScreenTag, 'id' | 'tenantId' | 'screenKey' | 'createdAt'>): Promise<ScreenTag> {
    const ref = await addDoc(tagsRef(tenantId, screenKey), { ...data, createdAt: serverTimestamp() });
    return { id: ref.id, tenantId, screenKey, ...data, createdAt: new Date() };
  }

  async updateTag(tenantId: string, screenKey: string, tagId: string, data: { name: string; color: string }): Promise<void> {
    await updateDoc(doc(tagsRef(tenantId, screenKey), tagId), data);
  }

  async deleteTag(tenantId: string, screenKey: string, tagId: string, actor: DeletionActor): Promise<void> {
    const ref = doc(tagsRef(tenantId, screenKey), tagId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }
}
