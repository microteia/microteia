import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../infrastructure/firebase/config';
import type { INewsDocumentRepository } from '../../domain/repositories/INewsDocumentRepository';
import type { NewsDocument } from '../../domain/entities';

const COL = 'newsDocuments';

const mapDoc = (id: string, d: Record<string, unknown>): NewsDocument => ({
  id,
  newsId: d.newsId as string,
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

export class FirebaseNewsDocumentRepository implements INewsDocumentRepository {
  async getDocuments(newsId: string): Promise<NewsDocument[]> {
    const q = query(collection(db, COL), where('newsId', '==', newsId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapDoc(d.id, d.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async uploadDocument(newsId: string, file: File): Promise<string> {
    const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const storagePath = `news/${newsId}/${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const url = await getDownloadURL(storageRef);
    return JSON.stringify({ url, storagePath });
  }

  async addDocument(
    newsId: string,
    data: Omit<NewsDocument, 'id' | 'newsId' | 'createdAt'>,
  ): Promise<NewsDocument> {
    const docRef = await addDoc(collection(db, COL), { ...data, newsId, createdAt: serverTimestamp() });
    return { id: docRef.id, newsId, ...data, createdAt: new Date() };
  }

  async deleteDocument(_newsId: string, documentId: string, storagePath: string): Promise<void> {
    await deleteDoc(doc(db, COL, documentId));
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // arquivo já pode ter sido removido
    }
  }
}
