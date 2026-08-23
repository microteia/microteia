import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { IUserRepository, CreateUserInput } from '../../domain/repositories/IUserRepository';
import type { UserInfo } from '../../domain/entities/UserInfo';

export class FirebaseUserRepository implements IUserRepository {
  constructor(private readonly db: Firestore) {}

  async getUserInfo(userId: string): Promise<UserInfo> {
    const snap = await this.db.collection('users').doc(userId).get();

    if (!snap.exists) {
      throw new Error('@core.workspace/user.not-found');
    }

    const data = snap.data() as Record<string, unknown>;

    return {
      displayName: (data.displayName as string) || '@core.workspace/user.unknown',
      photoURL: (data.photoURL as string | null) ?? null,
    };
  }

  async getUserRole(userId: string): Promise<string | null> {
    const snap = await this.db.collection('users').doc(userId).get();
    if (!snap.exists) return null;
    return (snap.data()?.role as string | undefined) ?? null;
  }

  /**
   * O PRIMEIRO usuário do sistema nasce `SYSTEM`; todos os demais nascem `USER`.
   *
   * Sem isso não haveria como começar: `SYSTEM` só é concedido por outro `SYSTEM`, e uma instalação
   * nova não tem nenhum. A marca fica num documento próprio (`system/bootstrap`) e é reivindicada
   * DENTRO da transação — contar usuários seria uma corrida entre dois primeiros logins simultâneos,
   * e o preço de perdê-la seria dois donos do sistema.
   *
   * `system/` é coleção de raiz sem regra nenhuma: o Firestore nega o que ninguém libera, então só o
   * Admin SDK a alcança.
   */
  async createUserIfMissing(userId: string, data: CreateUserInput): Promise<boolean> {
    const userRef = this.db.collection('users').doc(userId);
    const bootstrapRef = this.db.doc('system/bootstrap');

    return this.db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (userSnap.exists) return false;

      const bootstrapSnap = await tx.get(bootstrapRef);
      const isFirstUser = !bootstrapSnap.exists;
      if (isFirstUser) {
        tx.set(bootstrapRef, { claimedBy: userId, claimedAt: FieldValue.serverTimestamp() });
      }

      tx.set(userRef, {
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
        role: isFirstUser ? 'SYSTEM' : 'USER',
        createdAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
  }

  async createUserProfileIfMissing(userId: string): Promise<void> {
    const ref = this.db.collection('userProfiles').doc(userId);
    const snap = await ref.get();
    if (snap.exists) return;

    await ref.set({ userId });
  }
}
