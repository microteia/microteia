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
import type { IPersonDocumentRepository } from '../../domain/repositories/IPersonDocumentRepository';
import type { PersonDocument } from '../../domain/entities';

const docsRef = (tenantId: string, personId: string) =>
  collection(db, 'tenants', tenantId, 'persons', personId, 'documents');

const mapDoc = (id: string, d: Record<string, unknown>, tenantId: string, personId: string): PersonDocument => ({
  id,
  personId,
  tenantId,
  name: d.name as string,
  description: (d.description as string | undefined) ?? undefined,
  url: d.url as string,
  storagePath: d.storagePath as string,
  createdBy: d.createdBy as string,
  createdByName: d.createdByName as string,
  createdByPhotoUrl: (d.createdByPhotoUrl as string | undefined) ?? undefined,
  createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : (d.createdAt as Date),
});

export class FirebasePersonDocumentRepository implements IPersonDocumentRepository {
  async getDocuments(tenantId: string, personId: string): Promise<PersonDocument[]> {
    const q = query(docsRef(tenantId, personId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc(d.id, d.data(), tenantId, personId));
  }

  async uploadDocument(tenantId: string, personId: string, file: File): Promise<string> {
    const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const storagePath = `tenants/${tenantId}/persons/${personId}/${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);
    return JSON.stringify({ url, storagePath });
  }

  async addDocument(
    tenantId: string,
    personId: string,
    data: Omit<PersonDocument, 'id' | 'personId' | 'tenantId' | 'createdAt'>,
  ): Promise<PersonDocument> {
    const docRef = await addDoc(docsRef(tenantId, personId), { ...data, createdAt: serverTimestamp() });
    return { id: docRef.id, personId, tenantId, ...data, createdAt: new Date() };
  }

  async deleteDocument(tenantId: string, personId: string, documentId: string, storagePath: string): Promise<void> {
    await deleteDoc(doc(docsRef(tenantId, personId), documentId));
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // arquivo já pode ter sido removido
    }
  }
}
