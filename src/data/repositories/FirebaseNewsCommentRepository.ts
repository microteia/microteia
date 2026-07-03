import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc,
  doc, Timestamp, arrayUnion, arrayRemove, increment,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { INewsCommentRepository } from '../../domain/repositories/INewsCommentRepository';
import type { NewsComment, DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';

const COL = 'newsComments';

const mapDoc = (d: { id: string; data: () => Record<string, unknown> }): NewsComment => {
  const data = d.data();
  return {
    id: d.id,
    userId: data.userId as string,
    newsId: data.newsId as string,
    content: data.content as string,
    authorName: data.authorName as string,
    authorPhotoURL: (data.authorPhotoURL as string | null) ?? null,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    editedAt: data.editedAt ? (data.editedAt as Timestamp).toDate() : undefined,
    editedByName: (data.editedByName as string | undefined) ?? undefined,
    likeCount: (data.likeCount as number) ?? 0,
    likedBy: (data.likedBy as string[]) ?? [],
  };
};

export class FirebaseNewsCommentRepository implements INewsCommentRepository {
  async getComments(newsId: string): Promise<NewsComment[]> {
    const q = query(collection(db, COL), where('newsId', '==', newsId));
    const snap = await getDocs(q);
    const results = snap.docs.map((d) => mapDoc({ id: d.id, data: () => d.data() as Record<string, unknown> }));
    return results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getCommentCountMap(newsIds: string[]): Promise<Record<string, number>> {
    if (newsIds.length === 0) return {};
    const counts: Record<string, number> = {};
    newsIds.forEach((id) => { counts[id] = 0; });
    const chunks: string[][] = [];
    for (let i = 0; i < newsIds.length; i += 30) chunks.push(newsIds.slice(i, i + 30));
    await Promise.all(chunks.map(async (chunk) => {
      const snap = await getDocs(query(collection(db, COL), where('newsId', 'in', chunk)));
      snap.docs.forEach((d) => {
        const nid = d.data().newsId as string;
        counts[nid] = (counts[nid] ?? 0) + 1;
      });
    }));
    return counts;
  }

  async createComment(data: Omit<NewsComment, 'id' | 'likeCount' | 'likedBy'>): Promise<NewsComment> {
    const payload = {
      userId: data.userId,
      newsId: data.newsId,
      content: data.content,
      authorName: data.authorName,
      authorPhotoURL: data.authorPhotoURL,
      createdAt: Timestamp.fromDate(data.createdAt),
      likeCount: 0,
      likedBy: [],
    };
    const ref = await addDoc(collection(db, COL), payload);
    await updateDoc(doc(db, 'news', data.newsId), { commentCount: increment(1) });
    return { id: ref.id, ...data, likeCount: 0, likedBy: [] };
  }

  async updateComment(
    id: string,
    data: { content: string; editedAt: Date; editedByName: string },
  ): Promise<void> {
    await updateDoc(doc(db, COL, id), {
      content: data.content,
      editedAt: Timestamp.fromDate(data.editedAt),
      editedByName: data.editedByName,
    });
  }

  async deleteComment(id: string, newsId: string, actor: DeletionActor): Promise<void> {
    const ref = doc(db, COL, id);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
    await updateDoc(doc(db, 'news', newsId), { commentCount: increment(-1) });
  }

  async toggleLike(commentId: string, userId: string, hasLiked: boolean): Promise<void> {
    const ref = doc(db, COL, commentId);
    if (hasLiked) {
      await updateDoc(ref, { likedBy: arrayRemove(userId), likeCount: increment(-1) });
    } else {
      await updateDoc(ref, { likedBy: arrayUnion(userId), likeCount: increment(1) });
    }
  }
}
