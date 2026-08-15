import type { Firestore } from 'firebase-admin/firestore';
import type { INicknameRepository } from '../../domain/repositories/INicknameRepository';
import type { NicknameAvailability } from '../../domain/entities/NicknameInfo';
import { alreadyExists } from '../../domain/errors/DomainError';

export class FirebaseNicknameRepository implements INicknameRepository {
  constructor(private readonly db: Firestore) {}

  async checkAvailability(nickname: string, userId: string): Promise<NicknameAvailability> {
    const normalized = nickname.toLowerCase();
    const snap = await this.db.collection('nicknames').doc(normalized).get();

    if (snap.exists) {
      const data = snap.data() as { userId: string };
      if (data.userId === userId) {
        return { available: true };
      }
      return { available: false, reason: 'taken' };
    }

    return { available: true };
  }

  async getUserProfile(userId: string): Promise<{ nicknameSetAt?: Date } | null> {
    const snap = await this.db.collection('userProfiles').doc(userId).get();
    
    if (!snap.exists) {
      return null;
    }

    const data = snap.data() as Record<string, unknown>;
    return {
      nicknameSetAt: data.nicknameSetAt ? (data.nicknameSetAt as Date) : undefined,
    };
  }

  async claim(nickname: string, userId: string): Promise<void> {
    const normalized = nickname.toLowerCase();

    await this.db.runTransaction(async (tx) => {
      const profileRef = this.db.collection('userProfiles').doc(userId);
      const nicknameRef = this.db.collection('nicknames').doc(normalized);

      const profileSnap = await tx.get(profileRef);
      const nicknameSnap = await tx.get(nicknameRef);

      if (profileSnap.exists) {
        const profileData = profileSnap.data() as Record<string, unknown>;
        if (profileData.nicknameSetAt) {
          throw alreadyExists('@core.workspace/profile.nickname.already-set');
        }
      }

      if (nicknameSnap.exists) {
        throw alreadyExists('@core.workspace/profile.nickname.taken-error');
      }

      const now = new Date();
      tx.set(nicknameRef, { userId, claimedAt: now });
      tx.set(profileRef, { userId, nickname, nicknameSetAt: now }, { merge: true });
    });
  }
}
