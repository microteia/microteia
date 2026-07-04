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
import type { ICustomRecordNoteRepository } from '../../domain/repositories/ICustomRecordNoteRepository';
import type { CustomRecordNote, DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';

const notesRef = (tenantId: string, recordId: string) =>
  collection(db, 'tenants', tenantId, 'customRecords', recordId, 'notes');

const mapNote = (id: string, d: Record<string, unknown>, tenantId: string, recordId: string): CustomRecordNote => ({
  id,
  recordId,
  tenantId,
  screenKey: (d.screenKey as string | undefined) ?? '',
  title: (d.title as string | undefined) ?? '',
  text: d.text as string,
  createdBy: d.createdBy as string,
  createdByName: d.createdByName as string,
  createdByPhotoUrl: (d.createdByPhotoUrl as string | undefined) ?? undefined,
  createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : (d.createdAt as Date),
});

export class FirebaseCustomRecordNoteRepository implements ICustomRecordNoteRepository {
  async getNotes(tenantId: string, recordId: string): Promise<CustomRecordNote[]> {
    const q = query(notesRef(tenantId, recordId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapNote(d.id, d.data(), tenantId, recordId));
  }

  async addNote(
    tenantId: string,
    recordId: string,
    data: Omit<CustomRecordNote, 'id' | 'recordId' | 'tenantId' | 'createdAt'>,
  ): Promise<CustomRecordNote> {
    const ref = await addDoc(notesRef(tenantId, recordId), { ...data, createdAt: serverTimestamp() });
    return { id: ref.id, recordId, tenantId, ...data, createdAt: new Date() };
  }

  async deleteNote(tenantId: string, recordId: string, noteId: string, actor: DeletionActor): Promise<void> {
    const ref = doc(notesRef(tenantId, recordId), noteId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }
}
