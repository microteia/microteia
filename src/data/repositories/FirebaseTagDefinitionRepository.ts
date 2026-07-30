import {
  collection as firestoreCollection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type {
  ITagDefinitionRepository,
  TagDefinitionInput,
} from '../../domain/repositories/ITagDefinitionRepository';
import type { TagDefinition } from '../../domain/entities';

const definitionsRef = (tenantId: string) =>
  firestoreCollection(db, 'tenants', tenantId, 'tagDefinitions');

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : ((v as Date) ?? new Date()));

const mapDefinition = (id: string, d: Record<string, unknown>): TagDefinition => ({
  collection: id,
  label: (d.label as string | undefined) ?? id,
  ownerPluginId: (d.ownerPluginId as string | null | undefined) ?? null,
  ownerPluginIds: (d.ownerPluginIds as string[] | undefined) ?? [],
  createdAt: toDate(d.createdAt),
  createdBy: (d.createdBy as string | undefined) ?? '',
});

export class FirebaseTagDefinitionRepository implements ITagDefinitionRepository {
  subscribe(tenantId: string, onChange: (definitions: TagDefinition[]) => void): () => void {
    return onSnapshot(
      query(definitionsRef(tenantId), orderBy('label', 'asc')),
      (snap) => onChange(snap.docs.map((d) => mapDefinition(d.id, d.data()))),
      (error) => {
        console.error('[TagDefinitionRepository] subscribe:', error.message);
        onChange([]);
      },
    );
  }

  async getAll(tenantId: string): Promise<TagDefinition[]> {
    const snap = await getDocs(query(definitionsRef(tenantId), orderBy('label', 'asc')));
    return snap.docs.map((d) => mapDefinition(d.id, d.data()));
  }

  async upsert(tenantId: string, definition: TagDefinitionInput): Promise<TagDefinition> {
    const ref = doc(definitionsRef(tenantId), definition.collection);
    const { collection: _collection, ...data } = definition;
    void _collection;
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    const snap = await getDoc(ref);
    return mapDefinition(ref.id, snap.data() as Record<string, unknown>);
  }

  async delete(tenantId: string, collection: string): Promise<void> {
    await deleteDoc(doc(definitionsRef(tenantId), collection));
  }
}
