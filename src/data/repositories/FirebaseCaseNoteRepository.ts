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
import type { ICaseNoteRepository } from '../../domain/repositories/ICaseNoteRepository';
import type { CaseNote, DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';

const notesRef = (tenantId: string, caseId: string) =>
  collection(db, 'tenants', tenantId, 'cases', caseId, 'notes');

const mapNote = (id: string, d: Record<string, unknown>, tenantId: string, caseId: string): CaseNote => ({
  id,
  caseId,
  tenantId,
  title: (d.title as string | undefined) ?? '',
  text: d.text as string,
  createdBy: d.createdBy as string,
  createdByName: d.createdByName as string,
  createdByPhotoUrl: (d.createdByPhotoUrl as string | undefined) ?? undefined,
  createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : (d.createdAt as Date),
});

export class FirebaseCaseNoteRepository implements ICaseNoteRepository {
  async getNotes(tenantId: string, caseId: string): Promise<CaseNote[]> {
    const q = query(notesRef(tenantId, caseId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapNote(d.id, d.data(), tenantId, caseId));
  }

  async addNote(
    tenantId: string,
    caseId: string,
    data: Omit<CaseNote, 'id' | 'caseId' | 'tenantId' | 'createdAt'>,
  ): Promise<CaseNote> {
    const ref = await addDoc(notesRef(tenantId, caseId), { ...data, createdAt: serverTimestamp() });
    return { id: ref.id, caseId, tenantId, ...data, createdAt: new Date() };
  }

  async deleteNote(tenantId: string, caseId: string, noteId: string, actor: DeletionActor): Promise<void> {
    const ref = doc(notesRef(tenantId, caseId), noteId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }
}
