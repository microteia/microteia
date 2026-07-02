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
import type { IFinancialDocumentRepository } from '../../domain/repositories/IFinancialDocumentRepository';
import type { FinancialDocument } from '../../domain/entities';

const docsRef = (tenantId: string, financialId: string) =>
  collection(db, 'tenants', tenantId, 'financials', financialId, 'documents');

const mapDoc = (id: string, d: Record<string, unknown>, tenantId: string, financialId: string): FinancialDocument => ({
  id,
  financialId,
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

export class FirebaseFinancialDocumentRepository implements IFinancialDocumentRepository {
  async getDocuments(tenantId: string, financialId: string): Promise<FinancialDocument[]> {
    const q = query(docsRef(tenantId, financialId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc(d.id, d.data(), tenantId, financialId));
  }

  async uploadDocument(tenantId: string, financialId: string, file: File): Promise<string> {
    const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const storagePath = `tenants/${tenantId}/financials/${financialId}/${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);
    return JSON.stringify({ url, storagePath });
  }

  async addDocument(
    tenantId: string,
    financialId: string,
    data: Omit<FinancialDocument, 'id' | 'financialId' | 'tenantId' | 'createdAt'>,
  ): Promise<FinancialDocument> {
    const docRef = await addDoc(docsRef(tenantId, financialId), { ...data, createdAt: serverTimestamp() });
    return { id: docRef.id, financialId, tenantId, ...data, createdAt: new Date() };
  }

  async deleteDocument(tenantId: string, financialId: string, documentId: string, storagePath: string): Promise<void> {
    await deleteDoc(doc(docsRef(tenantId, financialId), documentId));
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // arquivo já pode ter sido removido
    }
  }
}
