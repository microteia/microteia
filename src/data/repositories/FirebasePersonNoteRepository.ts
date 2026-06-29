import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IPersonNoteRepository } from '../../domain/repositories/IPersonNoteRepository';
import type { PersonNote } from '../../domain/entities';

const notesRef = (tenantId: string, personId: string) =>
  collection(db, 'tenants', tenantId, 'persons', personId, 'notes');

const mapNote = (id: string, d: Record<string, unknown>, tenantId: string, personId: string): PersonNote => ({
  id,
  personId,
  tenantId,
  title: (d.title as string | undefined) ?? '',
  text: d.text as string,
  createdBy: d.createdBy as string,
  createdByName: d.createdByName as string,
  createdByPhotoUrl: (d.createdByPhotoUrl as string | undefined) ?? undefined,
  createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : (d.createdAt as Date),
});

export class FirebasePersonNoteRepository implements IPersonNoteRepository {
  async getNotes(tenantId: string, personId: string): Promise<PersonNote[]> {
    const q = query(notesRef(tenantId, personId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapNote(d.id, d.data(), tenantId, personId));
  }

  async addNote(
    tenantId: string,
    personId: string,
    data: Omit<PersonNote, 'id' | 'personId' | 'tenantId' | 'createdAt'>,
  ): Promise<PersonNote> {
    const ref = await addDoc(notesRef(tenantId, personId), { ...data, createdAt: serverTimestamp() });
    return { id: ref.id, personId, tenantId, ...data, createdAt: new Date() };
  }

  async deleteNote(tenantId: string, personId: string, noteId: string): Promise<void> {
    await deleteDoc(doc(notesRef(tenantId, personId), noteId));
  }
}
