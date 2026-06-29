import {
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, Timestamp,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { INewsTagRepository } from '../../domain/repositories/INewsTagRepository';
import type { NewsTag } from '../../domain/entities';

const COLLECTION = 'newsTags';

const mapDoc = (d: { id: string; data: () => Record<string, unknown> }): NewsTag => {
  const data = d.data();
  return {
    id: d.id,
    userId: data.userId as string,
    name: data.name as string,
    color: data.color as string,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
  };
};

export class FirebaseNewsTagRepository implements INewsTagRepository {
  async getTags(userId: string): Promise<NewsTag[]> {
    const q = query(collection(db, COLLECTION), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc({ id: d.id, data: () => d.data() as Record<string, unknown> }));
  }

  async createTag(userId: string, data: Omit<NewsTag, 'id' | 'userId' | 'createdAt'>): Promise<NewsTag> {
    const now = Timestamp.now();
    const ref = await addDoc(collection(db, COLLECTION), { ...data, userId, createdAt: now });
    return { id: ref.id, userId, createdAt: now.toDate(), ...data };
  }

  async updateTag(id: string, data: Partial<Pick<NewsTag, 'name' | 'color'>>): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), data);
  }

  async deleteTag(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  }
}
