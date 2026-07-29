import {
  addDoc,
  collection as firestoreCollection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IRecordNoteRepository } from '../../domain/repositories/IRecordRepository';
import type { RecordNote } from '../../domain/entities/EntityRecord';
import type { DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';

const notesRef = (tenantId: string, collection: string, recordId: string) =>
  firestoreCollection(db, 'tenants', tenantId, collection, recordId, 'notes');

const mapNote = (
  id: string,
  d: Record<string, unknown>,
  tenantId: string,
  collection: string,
  recordId: string,
): RecordNote => ({
  id,
  recordId,
  collection,
  tenantId,
  title: (d.title as string | undefined) ?? '',
  text: d.text as string,
  createdBy: d.createdBy as string,
  createdByName: d.createdByName as string,
  createdByPhotoUrl: (d.createdByPhotoUrl as string | undefined) ?? undefined,
  createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : (d.createdAt as Date),
});

export class FirebaseRecordNoteRepository implements IRecordNoteRepository {
  async getNotes(tenantId: string, collection: string, recordId: string): Promise<RecordNote[]> {
    const q = query(notesRef(tenantId, collection, recordId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapNote(d.id, d.data(), tenantId, collection, recordId));
  }

  async addNote(
    tenantId: string,
    collection: string,
    recordId: string,
    data: Omit<RecordNote, 'id' | 'recordId' | 'collection' | 'tenantId' | 'createdAt'>,
  ): Promise<RecordNote> {
    const ref = await addDoc(notesRef(tenantId, collection, recordId), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return { id: ref.id, recordId, collection, tenantId, ...data, createdAt: new Date() };
  }

  async deleteNote(
    tenantId: string,
    collection: string,
    recordId: string,
    noteId: string,
    actor: DeletionActor,
  ): Promise<void> {
    const ref = doc(notesRef(tenantId, collection, recordId), noteId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }
}
