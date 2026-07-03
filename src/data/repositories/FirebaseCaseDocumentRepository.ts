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
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../infrastructure/firebase/config';
import type { ICaseDocumentRepository } from '../../domain/repositories/ICaseDocumentRepository';
import type { CaseDocument, DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';

const docsRef = (tenantId: string, caseId: string) =>
  collection(db, 'tenants', tenantId, 'cases', caseId, 'documents');

const mapDoc = (id: string, d: Record<string, unknown>, tenantId: string, caseId: string): CaseDocument => ({
  id,
  caseId,
  tenantId,
  name: d.name as string,
  type: (d.type as string | undefined) ?? undefined,
  description: (d.description as string | undefined) ?? undefined,
  url: d.url as string,
  storagePath: d.storagePath as string,
  createdBy: d.createdBy as string,
  createdByName: d.createdByName as string,
  createdByPhotoUrl: (d.createdByPhotoUrl as string | undefined) ?? undefined,
  createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : (d.createdAt as Date),
});

export class FirebaseCaseDocumentRepository implements ICaseDocumentRepository {
  async getDocuments(tenantId: string, caseId: string): Promise<CaseDocument[]> {
    const q = query(docsRef(tenantId, caseId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc(d.id, d.data(), tenantId, caseId));
  }

  async uploadDocument(tenantId: string, caseId: string, file: File): Promise<string> {
    const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const storagePath = `tenants/${tenantId}/cases/${caseId}/${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);
    return JSON.stringify({ url, storagePath });
  }

  async addDocument(
    tenantId: string,
    caseId: string,
    data: Omit<CaseDocument, 'id' | 'caseId' | 'tenantId' | 'createdAt'>,
  ): Promise<CaseDocument> {
    const docRef = await addDoc(docsRef(tenantId, caseId), { ...data, createdAt: serverTimestamp() });
    return { id: docRef.id, caseId, tenantId, ...data, createdAt: new Date() };
  }

  async deleteDocument(tenantId: string, caseId: string, documentId: string, storagePath: string, actor: DeletionActor): Promise<void> {
    const docRef = doc(docsRef(tenantId, caseId), documentId);
    await stampDeletionActor(docRef, actor);
    await deleteDoc(docRef);
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // arquivo já pode ter sido removido
    }
  }
}
