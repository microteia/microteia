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
import type { IContractDocumentRepository } from '../../domain/repositories/IContractDocumentRepository';
import type { ContractDocument } from '../../domain/entities';

const docsRef = (tenantId: string, contractId: string) =>
  collection(db, 'tenants', tenantId, 'contracts', contractId, 'documents');

const mapDoc = (id: string, d: Record<string, unknown>, tenantId: string, contractId: string): ContractDocument => ({
  id,
  contractId,
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

export class FirebaseContractDocumentRepository implements IContractDocumentRepository {
  async getDocuments(tenantId: string, contractId: string): Promise<ContractDocument[]> {
    const q = query(docsRef(tenantId, contractId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc(d.id, d.data(), tenantId, contractId));
  }

  async uploadDocument(tenantId: string, contractId: string, file: File): Promise<string> {
    const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const storagePath = `tenants/${tenantId}/contracts/${contractId}/${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);
    return JSON.stringify({ url, storagePath });
  }

  async addDocument(
    tenantId: string,
    contractId: string,
    data: Omit<ContractDocument, 'id' | 'contractId' | 'tenantId' | 'createdAt'>,
  ): Promise<ContractDocument> {
    const docRef = await addDoc(docsRef(tenantId, contractId), { ...data, createdAt: serverTimestamp() });
    return { id: docRef.id, contractId, tenantId, ...data, createdAt: new Date() };
  }

  async deleteDocument(tenantId: string, contractId: string, documentId: string, storagePath: string): Promise<void> {
    await deleteDoc(doc(docsRef(tenantId, contractId), documentId));
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // arquivo já pode ter sido removido
    }
  }
}
