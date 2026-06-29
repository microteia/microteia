import {
  collection, getDocs, query, where, doc, setDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { INewsTagLinkRepository } from '../../domain/repositories/INewsTagLinkRepository';
import type { NewsTagLink } from '../../domain/entities';

const COLLECTION = 'newsTagLinks';

const mapDoc = (d: { id: string; data: () => Record<string, unknown> }): NewsTagLink => {
  const data = d.data();
  return {
    id: d.id,
    userId: data.userId as string,
    newsId: data.newsId as string,
    tagIds: (data.tagIds as string[]) ?? [],
  };
};

export class FirebaseNewsTagLinkRepository implements INewsTagLinkRepository {
  async getLinks(userId: string): Promise<NewsTagLink[]> {
    const q = query(collection(db, COLLECTION), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc({ id: d.id, data: () => d.data() as Record<string, unknown> }));
  }

  async setTagsForNews(userId: string, newsId: string, tagIds: string[]): Promise<void> {
    const docId = `${userId}_${newsId}`;
    const ref = doc(db, COLLECTION, docId);
    if (tagIds.length === 0) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, { userId, newsId, tagIds });
    }
  }
}
