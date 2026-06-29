import {
  collection, getDocs, query, where, Timestamp, doc, setDoc, getDoc,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { INewsInteractionRepository } from '../../domain/repositories/INewsInteractionRepository';
import type { NewsInteraction } from '../../domain/entities';

const COLLECTION = 'newsInteractions';

const mapDoc = (d: { id: string; data: () => Record<string, unknown> }): NewsInteraction => {
  const data = d.data();
  const toDateOpt = (v: unknown): Date | undefined =>
    v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : undefined;
  return {
    id: d.id,
    userId: data.userId as string,
    newsId: data.newsId as string,
    isRead: (data.isRead as boolean) ?? false,
    savedForLater: (data.savedForLater as boolean) ?? false,
    readAt: toDateOpt(data.readAt),
    savedAt: toDateOpt(data.savedAt),
    updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
  };
};

export class FirebaseNewsInteractionRepository implements INewsInteractionRepository {
  async getInteractionsForUser(userId: string): Promise<NewsInteraction[]> {
    const q = query(collection(db, COLLECTION), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc({ id: d.id, data: () => d.data() as Record<string, unknown> }));
  }

  async upsertInteraction(
    userId: string,
    newsId: string,
    data: Partial<Pick<NewsInteraction, 'isRead' | 'savedForLater' | 'readAt' | 'savedAt'>>,
  ): Promise<NewsInteraction> {
    const docId = `${userId}_${newsId}`;
    const ref = doc(db, COLLECTION, docId);
    const snap = await getDoc(ref);
    const now = Timestamp.now();

    const existing = snap.exists()
      ? mapDoc({ id: snap.id, data: () => snap.data() as Record<string, unknown> })
      : null;

    const merged: Record<string, unknown> = {
      userId,
      newsId,
      isRead: existing?.isRead ?? false,
      savedForLater: existing?.savedForLater ?? false,
      updatedAt: now,
      ...(existing?.readAt ? { readAt: Timestamp.fromDate(existing.readAt) } : {}),
      ...(existing?.savedAt ? { savedAt: Timestamp.fromDate(existing.savedAt) } : {}),
    };

    if ('isRead' in data) merged.isRead = data.isRead;
    if ('savedForLater' in data) merged.savedForLater = data.savedForLater;
    if (data.readAt) merged.readAt = Timestamp.fromDate(data.readAt);
    if (data.savedAt) merged.savedAt = Timestamp.fromDate(data.savedAt);

    await setDoc(ref, merged);

    return {
      id: docId,
      userId,
      newsId,
      isRead: merged.isRead as boolean,
      savedForLater: merged.savedForLater as boolean,
      readAt: data.readAt ?? existing?.readAt,
      savedAt: data.savedAt ?? existing?.savedAt,
      updatedAt: now.toDate(),
    };
  }
}
