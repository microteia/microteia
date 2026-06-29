import type { Firestore } from 'firebase-admin/firestore';
import type { IUserRepository } from '../../domain/repositories/IUserRepository';
import type { UserInfo } from '../../domain/entities/UserInfo';

export class FirebaseUserRepository implements IUserRepository {
  constructor(private readonly db: Firestore) {}

  async getUserInfo(userId: string): Promise<UserInfo> {
    const snap = await this.db.collection('users').doc(userId).get();

    if (!snap.exists) {
      throw new Error('Usuário não encontrado.');
    }

    const data = snap.data() as Record<string, unknown>;

    return {
      displayName: (data.displayName as string) || 'Usuário desconhecido',
      photoURL: (data.photoURL as string | null) ?? null,
    };
  }
}
