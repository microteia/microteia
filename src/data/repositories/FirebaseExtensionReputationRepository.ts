import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IExtensionReputationRepository } from '../../domain/repositories/IExtensionReputationRepository';
import type { ExtensionRatingInput, ExtensionStats } from '../../domain/entities/ExtensionReputation';

const statsRef = () => collection(db, 'extension_stats');
const publishersRef = () => collection(db, 'extension_publishers');
const ratingRef = (pluginId: string, userId: string) => doc(db, 'extension_stats', pluginId, 'ratings', userId);

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export const extensionStatsFromDoc = (id: string, d: Record<string, unknown>): ExtensionStats => ({
  id,
  installs: count(d.installs),
  ratingCount: count(d.ratingCount),
  ratingSum: count(d.ratingSum),
});

export class FirebaseExtensionReputationRepository implements IExtensionReputationRepository {
  subscribeStats(onChange: (stats: ExtensionStats[]) => void): () => void {
    return onSnapshot(
      statsRef(),
      (snap) => onChange(snap.docs.map((s) => extensionStatsFromDoc(s.id, s.data()))),
      (error) => console.error('[ExtensionReputationRepository] stats:', error.message),
    );
  }

  subscribeVerifiedPublishers(onChange: (tenantIds: string[]) => void): () => void {
    return onSnapshot(
      publishersRef(),
      (snap) => onChange(snap.docs.filter((s) => s.data().verified === true).map((s) => s.id)),
      (error) => console.error('[ExtensionReputationRepository] publishers:', error.message),
    );
  }

  async getRating(pluginId: string, userId: string): Promise<number | null> {
    const snap = await getDoc(ratingRef(pluginId, userId));
    const stars = snap.exists() ? snap.data().stars : null;
    return typeof stars === 'number' ? stars : null;
  }

  async rate(input: ExtensionRatingInput): Promise<void> {
    await setDoc(ratingRef(input.pluginId, input.userId), {
      stars: input.stars,
      tenantId: input.tenantId,
      updatedAt: serverTimestamp(),
    });
  }

  async clearRating(pluginId: string, userId: string): Promise<void> {
    await deleteDoc(ratingRef(pluginId, userId));
  }

  async setPublisherVerified(tenantId: string, verified: boolean, verifiedBy: string): Promise<void> {
    const ref = doc(publishersRef(), tenantId);
    if (!verified) {
      await deleteDoc(ref);
      return;
    }
    await setDoc(ref, { verified: true, verifiedBy, verifiedAt: serverTimestamp() });
  }
}
