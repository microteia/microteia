import {
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, Timestamp,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { ISavedFilterRepository } from '../../domain/repositories/ISavedFilterRepository';
import type { SavedFilter, SavedFilterToken } from '../../domain/entities';

const COLLECTION = 'savedFilters';

const mapDoc = (d: { id: string; data: () => Record<string, unknown> }): SavedFilter => {
  const data = d.data();
  return {
    id: d.id,
    userId: data.userId as string,
    screenKey: data.screenKey as string,
    name: data.name as string,
    tokens: (data.tokens as SavedFilterToken[]) ?? [],
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
  };
};

export class FirebaseSavedFilterRepository implements ISavedFilterRepository {
  async getFilters(userId: string): Promise<SavedFilter[]> {
    const q = query(collection(db, COLLECTION), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc({ id: d.id, data: () => d.data() as Record<string, unknown> }));
  }

  async createFilter(
    userId: string,
    screenKey: string,
    name: string,
    tokens: SavedFilterToken[],
  ): Promise<SavedFilter> {
    const now = Timestamp.now();
    const ref = await addDoc(collection(db, COLLECTION), { userId, screenKey, name, tokens, createdAt: now });
    return { id: ref.id, userId, screenKey, name, tokens, createdAt: now.toDate() };
  }

  async updateFilter(
    id: string,
    data: { name?: string; tokens?: SavedFilterToken[] },
  ): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), data);
  }

  async deleteFilter(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  }
}
