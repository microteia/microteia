import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { IUserRepository, CreateUserInput } from '../../domain/repositories/IUserRepository';
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

  async getUserRole(userId: string): Promise<string | null> {
    const snap = await this.db.collection('users').doc(userId).get();
    if (!snap.exists) return null;
    return (snap.data()?.role as string | undefined) ?? null;
  }

  async createUserIfMissing(userId: string, data: CreateUserInput): Promise<boolean> {
    const ref = this.db.collection('users').doc(userId);
    const snap = await ref.get();
    if (snap.exists) return false;

    await ref.set({
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      role: 'USER',
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  }

  async createUserProfileIfMissing(userId: string): Promise<void> {
    const ref = this.db.collection('userProfiles').doc(userId);
    const snap = await ref.get();
    if (snap.exists) return;

    await ref.set({ userId });
  }
}
