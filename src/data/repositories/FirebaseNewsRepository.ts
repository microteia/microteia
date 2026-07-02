import {
  collection, addDoc, getDocs, updateDoc,
  deleteDoc, doc, query, where, Timestamp, deleteField, getDoc, orderBy,
  arrayUnion, arrayRemove, increment, onSnapshot, FieldValue,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { INewsRepository } from '../../domain/repositories/INewsRepository';
import type { News } from '../../domain/entities';

const COLLECTION = 'news';

const toDate = (value: unknown): Date => {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value as string);
};

const mapDoc = (d: { id: string; data: () => Record<string, unknown> }): News => {
  const data = d.data();
  return {
    id: d.id,
    userId: data.userId as string,
    createdBy: (data.createdBy as string) ?? (data.userId as string),
    tenantId: (data.tenantId as string | null) ?? null,
    title: data.title as string,
    summary: data.summary as string,
    content: data.content as string | undefined,
    category: (data.category as string) ?? 'GENERAL',
    sourceURL: data.sourceURL as string | undefined,
    imageURL: data.imageURL as string | undefined,
    likeCount: (data.likeCount as number) ?? 0,
    likedBy: (data.likedBy as string[]) ?? [],
    viewCount: (data.viewCount as number) ?? 0,
    commentCount: (data.commentCount as number) ?? 0,
    authorName: (data.authorName as string | undefined) ?? undefined,
    authorPhotoURL: (data.authorPhotoURL as string | null | undefined) ?? undefined,
    editedAt: data.editedAt ? toDate(data.editedAt) : undefined,
    editedByName: data.editedByName as string | undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
};

export class FirebaseNewsRepository implements INewsRepository {
  async getNews(_userId: string, _userRole: string, tenantId: string | null): Promise<News[]> {
    // Sempre busca notícias do sistema (tenantId === null)
    const systemQuery = query(
      collection(db, COLLECTION),
      where('tenantId', '==', null),
      orderBy('createdAt', 'desc'),
    );

    const queries = [systemQuery];

    // Busca notícias do tenant atual quando há tenant selecionado
    if (tenantId) {
      queries.push(query(
        collection(db, COLLECTION),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc'),
      ));
    }

    const snaps = await Promise.all(queries.map((q) => getDocs(q)));
    const map = new Map<string, News>();

    for (const snap of snaps) {
      for (const d of snap.docs) {
        if (!map.has(d.id)) {
          map.set(d.id, mapDoc({ id: d.id, data: () => d.data() as Record<string, unknown> }));
        }
      }
    }

    return [...map.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getNewsById(id: string): Promise<News | null> {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return mapDoc({ id: snap.id, data: () => snap.data() as Record<string, unknown> });
  }

  async createNews(
    userId: string,
    data: Omit<News, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<News> {
    const now = Timestamp.now();
    const payload: Record<string, unknown> = {
      ...data,
      userId,
      createdAt: now,
      updatedAt: now,
    };
    // Mantém tenantId: null explicitamente no Firestore
    if (payload['tenantId'] === undefined) payload['tenantId'] = null;
    for (const key of Object.keys(payload)) {
      if (payload[key] === undefined) delete payload[key];
    }
    const ref = await addDoc(collection(db, COLLECTION), payload);
    const nowDate = new Date();
    return { id: ref.id, userId, createdAt: nowDate, updatedAt: nowDate, ...data };
  }

  async updateNews(
    id: string,
    data: Partial<Omit<News, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<void> {
    const { content, sourceURL, imageURL, editedAt, ...rest } = data;
    const payload: Record<string, unknown | FieldValue> = {
      ...rest,
      updatedAt: Timestamp.now(),
    };
    if ('content' in data) {
      payload.content = content !== undefined ? content : deleteField();
    }
    if ('sourceURL' in data) {
      payload.sourceURL = sourceURL !== undefined ? sourceURL : deleteField();
    }
    if ('imageURL' in data) {
      payload.imageURL = imageURL !== undefined ? imageURL : deleteField();
    }
    if ('editedAt' in data) {
      payload.editedAt = editedAt ? Timestamp.fromDate(editedAt) : deleteField();
    }
    await updateDoc(doc(db, COLLECTION, id), payload);
  }

  async deleteNews(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  }

  async toggleLike(id: string, userId: string, hasLiked: boolean): Promise<void> {
    const ref = doc(db, COLLECTION, id);
    if (hasLiked) {
      await updateDoc(ref, { likedBy: arrayRemove(userId), likeCount: increment(-1) });
    } else {
      await updateDoc(ref, { likedBy: arrayUnion(userId), likeCount: increment(1) });
    }
  }

  async incrementView(id: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), { viewCount: increment(1) });
  }

  subscribeToNews(tenantId: string | null, onUpdate: (news: News[]) => void): () => void {
    // Subscription para notícias do sistema (tenantId === null)
    const systemQ = query(
      collection(db, COLLECTION),
      where('tenantId', '==', null),
      orderBy('createdAt', 'desc'),
    );

    let systemNews: News[] = [];
    let tenantNews: News[] = [];

    const merge = () => {
      const map = new Map<string, News>();
      [...systemNews, ...tenantNews].forEach((n) => map.set(n.id, n));
      const sorted = [...map.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      onUpdate(sorted);
    };

    const unsubSystem = onSnapshot(
      systemQ,
      (snap) => {
        systemNews = snap.docs.map((d) =>
          mapDoc({ id: d.id, data: () => d.data() as Record<string, unknown> }),
        );
        merge();
      },
      (error) => {
        console.error('[NewsRepository] subscribeToNews (system):', error.message);
      },
    );

    if (!tenantId) {
      return unsubSystem;
    }

    const tenantQ = query(
      collection(db, COLLECTION),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc'),
    );

    const unsubTenant = onSnapshot(
      tenantQ,
      (snap) => {
        tenantNews = snap.docs.map((d) =>
          mapDoc({ id: d.id, data: () => d.data() as Record<string, unknown> }),
        );
        merge();
      },
      (error) => {
        console.error('[NewsRepository] subscribeToNews (tenant):', error.message);
      },
    );

    return () => {
      unsubSystem();
      unsubTenant();
    };
  }
}
