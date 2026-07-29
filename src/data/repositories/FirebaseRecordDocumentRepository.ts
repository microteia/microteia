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
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../infrastructure/firebase/config';
import type { IRecordDocumentRepository } from '../../domain/repositories/IRecordRepository';
import type { RecordDocument } from '../../domain/entities/EntityRecord';
import type { DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';

const docsRef = (tenantId: string, collection: string, recordId: string) =>
  firestoreCollection(db, 'tenants', tenantId, collection, recordId, 'documents');

const mapDoc = (
  id: string,
  d: Record<string, unknown>,
  tenantId: string,
  collection: string,
  recordId: string,
): RecordDocument => ({
  id,
  recordId,
  collection,
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

export class FirebaseRecordDocumentRepository implements IRecordDocumentRepository {
  async getDocuments(
    tenantId: string,
    collection: string,
    recordId: string,
  ): Promise<RecordDocument[]> {
    const q = query(docsRef(tenantId, collection, recordId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc(d.id, d.data(), tenantId, collection, recordId));
  }

  async uploadDocument(
    tenantId: string,
    collection: string,
    recordId: string,
    file: File,
  ): Promise<string> {
    const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const storagePath = `tenants/${tenantId}/${collection}/${recordId}/${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);
    return JSON.stringify({ url, storagePath });
  }

  async addDocument(
    tenantId: string,
    collection: string,
    recordId: string,
    data: Omit<RecordDocument, 'id' | 'recordId' | 'collection' | 'tenantId' | 'createdAt'>,
  ): Promise<RecordDocument> {
    const docRef = await addDoc(docsRef(tenantId, collection, recordId), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return { id: docRef.id, recordId, collection, tenantId, ...data, createdAt: new Date() };
  }

  async deleteDocument(
    tenantId: string,
    collection: string,
    recordId: string,
    documentId: string,
    storagePath: string,
    actor: DeletionActor,
  ): Promise<void> {
    const docRef = doc(docsRef(tenantId, collection, recordId), documentId);
    await stampDeletionActor(docRef, actor);
    await deleteDoc(docRef);
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // arquivo já pode ter sido removido
    }
  }
}
