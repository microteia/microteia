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
  updateDoc,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../infrastructure/firebase/config';
import type { IRecordDocumentRepository } from '../../domain/repositories/IRecordRepository';
import type { RecordDocument } from '../../domain/entities/EntityRecord';
import type { DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';
import { LocalizedError } from '../../domain/errors/LocalizedError';

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
  portalShared: d.portalShared === true,
  sha256: typeof d.sha256 === 'string' ? d.sha256 : undefined,
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
    try {
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      return JSON.stringify({ url, storagePath });
    } catch (error) {
      // A recusa do `storage.rules` acontece antes de qualquer gravação no Firestore: não deixa rastro
      // na Auditoria, e a mensagem genérica deixava permissão e queda de rede indistinguíveis.
      if ((error as { code?: string } | null)?.code === 'storage/unauthorized') {
        throw new LocalizedError('@core.ui/documents.upload-denied', undefined, { cause: error });
      }
      throw error;
    }
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

  async setPortalShared(
    tenantId: string,
    collection: string,
    recordId: string,
    documentId: string,
    shared: boolean,
    actorUid: string,
  ): Promise<void> {
    await updateDoc(doc(docsRef(tenantId, collection, recordId), documentId), {
      portalShared: shared,
      portalSharedBy: actorUid,
      portalSharedAt: serverTimestamp(),
    });
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
