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
  ILookupDefinitionRepository,
  LookupDefinitionInput,
} from '../../domain/repositories/ILookupDefinitionRepository';
import type { LookupDefinition } from '../../domain/entities';

const definitionsRef = (tenantId: string) =>
  firestoreCollection(db, 'tenants', tenantId, 'lookupDefinitions');

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : ((v as Date) ?? new Date()));

const mapDefinition = (id: string, d: Record<string, unknown>): LookupDefinition => ({
  collection: id,
  label: (d.label as string | undefined) ?? id,
  ownerPluginId: (d.ownerPluginId as string | null | undefined) ?? null,
  ownerPluginIds: (d.ownerPluginIds as string[] | undefined) ?? [],
  createdAt: toDate(d.createdAt),
  createdBy: (d.createdBy as string | undefined) ?? '',
});

export class FirebaseLookupDefinitionRepository implements ILookupDefinitionRepository {
  subscribe(tenantId: string, onChange: (definitions: LookupDefinition[]) => void): () => void {
    return onSnapshot(
      query(definitionsRef(tenantId), orderBy('label', 'asc')),
      (snap) => onChange(snap.docs.map((d) => mapDefinition(d.id, d.data()))),
      (error) => {
        console.error('[LookupDefinitionRepository] subscribe:', error.message);
        onChange([]);
      },
    );
  }

  async getAll(tenantId: string): Promise<LookupDefinition[]> {
    const snap = await getDocs(query(definitionsRef(tenantId), orderBy('label', 'asc')));
    return snap.docs.map((d) => mapDefinition(d.id, d.data()));
  }

  async upsert(tenantId: string, definition: LookupDefinitionInput): Promise<LookupDefinition> {
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
