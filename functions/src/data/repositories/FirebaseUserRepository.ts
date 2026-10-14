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
   *
   * A AUSÊNCIA da marca não basta para provar que a instalação é nova: um banco anterior a ela não a
   * tem, e o primeiro login novo depois do deploy virava `SYSTEM` — com acesso a todos os
   * escritórios. Por isso, sem marca, ainda se confere na mesma transação que não há usuário nem
   * escritório algum. Havendo, a instalação é antiga: a marca é gravada sem dono e a porta se fecha.
   */
  async createUserIfMissing(userId: string, data: CreateUserInput): Promise<boolean> {
    const userRef = this.db.collection('users').doc(userId);
    const bootstrapRef = this.db.doc('system/bootstrap');

    return this.db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (userSnap.exists) return false;

      const bootstrapSnap = await tx.get(bootstrapRef);
      let isFirstUser = false;
      if (!bootstrapSnap.exists) {
        const [anyUser, anyTenant] = await Promise.all([
          tx.get(this.db.collection('users').limit(1)),
          tx.get(this.db.collection('tenants').limit(1)),
        ]);
        isFirstUser = anyUser.empty && anyTenant.empty;
        tx.set(bootstrapRef, {
          claimedBy: isFirstUser ? userId : null,
          claimedAt: FieldValue.serverTimestamp(),
        });
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
