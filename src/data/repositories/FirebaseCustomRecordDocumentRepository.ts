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
import type { ICustomRecordDocumentRepository } from '../../domain/repositories/ICustomRecordDocumentRepository';
import type { CustomRecordDocument, DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';

const docsRef = (tenantId: string, recordId: string) =>
  collection(db, 'tenants', tenantId, 'customRecords', recordId, 'documents');

const mapDoc = (id: string, d: Record<string, unknown>, tenantId: string, recordId: string): CustomRecordDocument => ({
  id,
  recordId,
  tenantId,
  screenKey: (d.screenKey as string | undefined) ?? '',
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

export class FirebaseCustomRecordDocumentRepository implements ICustomRecordDocumentRepository {
  async getDocuments(tenantId: string, recordId: string): Promise<CustomRecordDocument[]> {
    const q = query(docsRef(tenantId, recordId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc(d.id, d.data(), tenantId, recordId));
  }

  async uploadDocument(tenantId: string, recordId: string, file: File): Promise<string> {
    const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const storagePath = `tenants/${tenantId}/customRecords/${recordId}/${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);
    return JSON.stringify({ url, storagePath });
  }

  async addDocument(
    tenantId: string,
    recordId: string,
    data: Omit<CustomRecordDocument, 'id' | 'recordId' | 'tenantId' | 'createdAt'>,
  ): Promise<CustomRecordDocument> {
    const docRef = await addDoc(docsRef(tenantId, recordId), { ...data, createdAt: serverTimestamp() });
    return { id: docRef.id, recordId, tenantId, ...data, createdAt: new Date() };
  }

  async deleteDocument(tenantId: string, recordId: string, documentId: string, storagePath: string, actor: DeletionActor): Promise<void> {
    const docRef = doc(docsRef(tenantId, recordId), documentId);
    await stampDeletionActor(docRef, actor);
    await deleteDoc(docRef);
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // arquivo já pode ter sido removido
    }
  }
}
