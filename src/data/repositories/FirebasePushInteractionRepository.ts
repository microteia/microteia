import {
  collection, getDocs, query, where, Timestamp, doc, setDoc, getDoc, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IPushInteractionRepository } from '../../domain/repositories/IPushRepository';
import type { PushInteraction } from '../../domain/entities';

const COLLECTION = 'pushInteractions';

const toPushInteraction = (interactionId: string, data: Record<string, unknown>): PushInteraction => {
  const toDateOpt = (v: unknown): Date | undefined =>
    v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : undefined;

  return {
    id: interactionId,
    userId: data.userId as string,
    pushId: data.pushId as string,
    isRead: (data.isRead as boolean) ?? false,
    readAt: toDateOpt(data.readAt),
    createdAt: toDateOpt(data.createdAt) ?? new Date(),
  };
};

export class FirebasePushInteractionRepository implements IPushInteractionRepository {
  async getInteractions(userId: string): Promise<PushInteraction[]> {
    const q = query(collection(db, COLLECTION), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => toPushInteraction(d.id, d.data() as Record<string, unknown>));
  }

  async upsertInteraction(
    userId: string,
    pushId: string,
    data: Partial<Omit<PushInteraction, 'id' | 'userId' | 'pushId' | 'createdAt'>>,
  ): Promise<PushInteraction> {
    const docId = `${userId}_${pushId}`;
    const ref = doc(db, COLLECTION, docId);
    const snap = await getDoc(ref);

    const existing = snap.exists()
      ? toPushInteraction(snap.id, snap.data() as Record<string, unknown>)
      : null;

    const merged: Record<string, unknown> = {
      userId,
      pushId,
      isRead: existing?.isRead ?? false,
      createdAt: existing?.createdAt ? Timestamp.fromDate(existing.createdAt) : Timestamp.now(),
      ...(existing?.readAt ? { readAt: Timestamp.fromDate(existing.readAt) } : {}),
    };

    if ('isRead' in data) merged.isRead = data.isRead;
    if (data.readAt) merged.readAt = Timestamp.fromDate(data.readAt);

    await setDoc(ref, merged);

    return {
      id: docId,
      userId,
      pushId,
      isRead: merged.isRead as boolean,
      readAt: data.readAt ?? existing?.readAt,
      createdAt: (merged.createdAt as Timestamp).toDate(),
    };
  }

  subscribeToInteractions(userId: string, callback: (interactions: PushInteraction[]) => void): () => void {
    const q = query(collection(db, COLLECTION), where('userId', '==', userId));

    return onSnapshot(q, (snap) => {
      const interactions = snap.docs.map(d => toPushInteraction(d.id, d.data() as Record<string, unknown>));
      callback(interactions);
    });
  }
}
