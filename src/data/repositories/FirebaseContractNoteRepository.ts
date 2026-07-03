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
import type { IContractNoteRepository } from '../../domain/repositories/IContractNoteRepository';
import type { ContractNote, DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';

const notesRef = (tenantId: string, contractId: string) =>
  collection(db, 'tenants', tenantId, 'contracts', contractId, 'notes');

const mapNote = (id: string, d: Record<string, unknown>, tenantId: string, contractId: string): ContractNote => ({
  id,
  contractId,
  tenantId,
  title: (d.title as string | undefined) ?? '',
  text: d.text as string,
  createdBy: d.createdBy as string,
  createdByName: d.createdByName as string,
  createdByPhotoUrl: (d.createdByPhotoUrl as string | undefined) ?? undefined,
  createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : (d.createdAt as Date),
});

export class FirebaseContractNoteRepository implements IContractNoteRepository {
  async getNotes(tenantId: string, contractId: string): Promise<ContractNote[]> {
    const q = query(notesRef(tenantId, contractId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapNote(d.id, d.data(), tenantId, contractId));
  }

  async addNote(
    tenantId: string,
    contractId: string,
    data: Omit<ContractNote, 'id' | 'contractId' | 'tenantId' | 'createdAt'>,
  ): Promise<ContractNote> {
    const ref = await addDoc(notesRef(tenantId, contractId), { ...data, createdAt: serverTimestamp() });
    return { id: ref.id, contractId, tenantId, ...data, createdAt: new Date() };
  }

  async deleteNote(tenantId: string, contractId: string, noteId: string, actor: DeletionActor): Promise<void> {
    const ref = doc(notesRef(tenantId, contractId), noteId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }
}
