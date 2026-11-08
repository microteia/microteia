import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { IUserRepository, CreateUserInput, CreatedUser, StoredUser } from '../../domain/repositories/IUserRepository';
import type { UserInfo } from '../../domain/entities/UserInfo';
import { REGISTRATION_POLICY_PATH } from '../../domain/schema/registration';

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

  async exists(userId: string): Promise<boolean> {
    return (await this.db.collection('users').doc(userId).get()).exists;
  }

  async getSystemAccounts(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const snaps = await this.db.getAll(...userIds.map((userId) => this.db.collection('users').doc(userId)));
    return new Set(snaps.filter((snap) => snap.get('role') === 'SYSTEM').map((snap) => snap.id));
  }

  /**
   * O PRIMEIRO usuário do sistema nasce `SYSTEM`; todos os demais nascem `USER`.
   *
   * Sem isso não haveria como começar: `SYSTEM` só é concedido por outro `SYSTEM`, e uma instalação
   * nova não tem nenhum. A marca fica num documento próprio (`system/bootstrap`) e é reivindicada
   * DENTRO da transação — contar usuários seria uma corrida entre dois primeiros logins simultâneos,
   * e o preço de perdê-la seria dois donos do sistema.
   *
   * `system/bootstrap` não tem regra nenhuma: o Firestore nega o que ninguém libera, então só o Admin SDK
   * a alcança. (O único documento de `system/` que a regra libera é `system/registration`, ao `SYSTEM`.)
   *
   * A AUSÊNCIA da marca não basta para provar que a instalação é nova: um banco anterior a ela não a
   * tem, e o primeiro login novo depois do deploy virava `SYSTEM` — com acesso a todos os
   * escritórios. Por isso, sem marca, ainda se confere na mesma transação que não há usuário nem
   * escritório algum. Havendo, a instalação é antiga: a marca é gravada sem dono e a porta se fecha.
   */
  async createUserIfMissing(userId: string, data: CreateUserInput): Promise<CreatedUser | null> {
    const userRef = this.db.collection('users').doc(userId);
    const bootstrapRef = this.db.doc('system/bootstrap');

    return this.db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (userSnap.exists) return null;

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
        // A instalação nova nasce FECHADA para contas novas: quem abre é o `SYSTEM` que está nascendo
        // aqui, em Gestão de Acessos. Na mesma transação, para não haver instante em que a primeira
        // conta exista e a trava ainda não.
        if (isFirstUser) {
          tx.set(this.db.doc(REGISTRATION_POLICY_PATH), {
            acceptNewAccounts: false,
            updatedBy: userId,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      tx.set(userRef, {
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
        role: isFirstUser ? 'SYSTEM' : 'USER',
        ...(data.origin ? { origin: data.origin } : {}),
        createdAt: FieldValue.serverTimestamp(),
      });
      return { firstUser: isFirstUser };
    });
  }

  async setOrigin(userId: string, origin: 'invitation'): Promise<void> {
    await this.db.collection('users').doc(userId).update({ origin });
  }

  async findByEmail(email: string): Promise<StoredUser | null> {
    for (const candidate of [...new Set([email, email.toLowerCase()])]) {
      const snap = await this.db.collection('users').where('email', '==', candidate).limit(1).get();
      if (snap.empty) continue;
      const doc = snap.docs[0];
      const origin = doc.get('origin');
      return {
        userId: doc.id,
        email: String(doc.get('email') ?? candidate),
        displayName: String(doc.get('displayName') ?? ''),
        photoURL: typeof doc.get('photoURL') === 'string' ? (doc.get('photoURL') as string) : null,
        origin: origin === 'portal' || origin === 'invitation' ? origin : null,
      };
    }
    return null;
  }

  async getTenantIds(userId: string): Promise<string[]> {
    const ids = (await this.db.collection('users').doc(userId).get()).get('tenantIds');
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  }

  async createUserProfileIfMissing(userId: string): Promise<void> {
    const ref = this.db.collection('userProfiles').doc(userId);
    const snap = await ref.get();
    if (snap.exists) return;

    await ref.set({ userId });
  }
}
