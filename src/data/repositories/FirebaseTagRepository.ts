import {
  addDoc,
  collection as firestoreCollection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { ITagRepository, TagInput } from '../../domain/repositories/ITagRepository';
import type { DeletionActor, Tag } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';

const tagsRef = (tenantId: string, collection: string) =>
  firestoreCollection(db, 'tenants', tenantId, collection);

const mapTag = (id: string, d: Record<string, unknown>, tenantId: string): Tag => ({
  id,
  tenantId,
  name: d.name as string,
  color: d.color as string,
  createdBy: (d.createdBy as string | undefined) ?? '',
  createdByName: d.createdByName as string | undefined,
  createdByPhotoURL: d.createdByPhotoURL as string | undefined,
  createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : ((d.createdAt as Date) ?? new Date()),
});

/**
 * Um repositório para TODAS as etiquetas. Substitui os 4 `Firebase*TagRepository` (que só diferiam
 * no nome da coleção) e os métodos de etiqueta do repositório de telas, que gravavam numa
 * subcoleção de `screenDefinitions` — e por isso morriam junto com a tela.
 */
export class FirebaseTagRepository implements ITagRepository {
  subscribe(tenantId: string, collection: string, onChange: (tags: Tag[]) => void): () => void {
    return onSnapshot(
      query(tagsRef(tenantId, collection), orderBy('name', 'asc')),
      (snap) => onChange(snap.docs.map((d) => mapTag(d.id, d.data(), tenantId))),
      (error) => {
        console.error(`[TagRepository] subscribe ${collection}:`, error.message);
        onChange([]);
      },
    );
  }

  async getAll(tenantId: string, collection: string): Promise<Tag[]> {
    const snap = await getDocs(query(tagsRef(tenantId, collection), orderBy('name', 'asc')));
    return snap.docs.map((d) => mapTag(d.id, d.data(), tenantId));
  }

  async create(tenantId: string, collection: string, data: TagInput): Promise<Tag> {
    const payload = Object.fromEntries(
      Object.entries({ ...data, createdAt: serverTimestamp() }).filter(([, value]) => value !== undefined),
    );
    const ref = await addDoc(tagsRef(tenantId, collection), payload);
    return { id: ref.id, tenantId, createdBy: '', ...data, createdAt: new Date() };
  }

  async update(
    tenantId: string,
    collection: string,
    tagId: string,
    data: { name: string; color: string },
  ): Promise<void> {
    await updateDoc(doc(tagsRef(tenantId, collection), tagId), data);
  }

  async delete(
    tenantId: string,
    collection: string,
    tagId: string,
    actor: DeletionActor,
  ): Promise<void> {
    const ref = doc(tagsRef(tenantId, collection), tagId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }
}
