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
import type { ScreenTag, DeletionActor, ScreenDefinition, ScreenFieldOption } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';
import { mapScreenDefinition } from './screenDefinitionMapper';

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : (v as Date);

const definitionsRef = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'screenDefinitions');

const fieldOptionsRef = (tenantId: string, screenKey: string) =>
  collection(db, 'tenants', tenantId, 'screenDefinitions', screenKey, 'fieldOptions');

const tagsRef = (tenantId: string, screenKey: string) =>
  collection(db, 'tenants', tenantId, 'screenDefinitions', screenKey, 'tags');


const mapFieldOption = (id: string, d: Record<string, unknown>, tenantId: string, screenKey: string): ScreenFieldOption => ({
  id,
  tenantId,
  screenKey,
  fieldKey: d.fieldKey as string,
  key: d.key as string,
  label: d.label as string,
  createdAt: toDate(d.createdAt),
  createdBy: (d.createdBy as string | undefined) ?? '',
});

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
    const optionsSnap = await getDocs(fieldOptionsRef(tenantId, screenKey));
    await Promise.all(optionsSnap.docs.map((d) => deleteDoc(d.ref)));
    const tagsSnap = await getDocs(tagsRef(tenantId, screenKey));
    await Promise.all(tagsSnap.docs.map((d) => deleteDoc(d.ref)));
    const ref = doc(definitionsRef(tenantId), screenKey);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }

  async getFieldOptions(tenantId: string, screenKey: string): Promise<ScreenFieldOption[]> {
    const snap = await getDocs(query(fieldOptionsRef(tenantId, screenKey), orderBy('label', 'asc')));
    return snap.docs.map((d) => mapFieldOption(d.id, d.data(), tenantId, screenKey));
  }

  async addFieldOption(tenantId: string, screenKey: string, fieldKey: string, label: string, userId: string): Promise<ScreenFieldOption> {
    const ref = await addDoc(fieldOptionsRef(tenantId, screenKey), {
      fieldKey,
      key: label,
      label,
      createdBy: userId,
      createdAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapFieldOption(ref.id, snap.data() as Record<string, unknown>, tenantId, screenKey);
  }

  async removeFieldOption(tenantId: string, screenKey: string, optionId: string): Promise<void> {
    await deleteDoc(doc(fieldOptionsRef(tenantId, screenKey), optionId));
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
