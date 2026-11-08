import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { AppUser, UserRole } from '../../domain/entities';
import type { IUserRepository } from '../../domain/repositories/IUserRepository';

import { LocalizedError } from '../../domain/errors/LocalizedError';
import { REGISTRATION_CLOSED_MESSAGE, REGISTRATION_REFUSALS_COLLECTION } from '../../domain/schema/registration';

const fromDoc = (id: string, data: Record<string, unknown>): AppUser => ({
  id,
  email: data.email as string,
  displayName: data.displayName as string,
  photoURL: (data.photoURL as string | null) ?? null,
  role: (data.role as UserRole) ?? 'USER',
  createdAt: (data.createdAt as { toDate(): Date } | null)?.toDate() ?? new Date(),
});

export class FirebaseUserRepository implements IUserRepository {
  async getCurrentUserProfile(userId: string): Promise<AppUser | null> {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    return fromDoc(snap.id, snap.data());
  }

  async waitForProvisioning(userId: string, timeoutMs = 20000): Promise<AppUser> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const unsubscribers: Array<() => void> = [];
      const settle = (finish: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        unsubscribers.forEach((unsubscribe) => unsubscribe());
        finish();
      };
      const timeoutId = setTimeout(
        () => settle(() => reject(new LocalizedError('@core.workspace/account.setup-timeout'))),
        timeoutMs,
      );
      const fail = (err: unknown) => settle(() => reject(err));

      unsubscribers.push(onSnapshot(
        doc(db, 'users', userId),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          const tenantIds = (data.tenantIds as string[] | undefined) ?? [];
          // O convidado do portal não ganha escritório, nem a conta aberta numa instalação que desligou
          // o autocadastro (`invitation`): o sinal de que o bootstrap terminou, para eles, é a origem
          // carimbada no documento.
          if (tenantIds.length === 0 && data.origin !== 'portal' && data.origin !== 'invitation') return;
          settle(() => resolve(fromDoc(snap.id, data)));
        },
        fail,
      ));
      // A instalação fechada para contas novas não provisiona: o gatilho grava a recusa e apaga a conta.
      // Sem ouvi-la, a pessoa esperaria o tempo-limite inteiro por um documento que não vem.
      //
      // O erro DESTA escuta não encerra a espera: ela é só a explicação de uma recusa. Com as regras
      // ainda sem o bloco da recusa (projeto com deploy atrasado), ela respondia `permission-denied` e
      // derrubava a espera inteira — o `SYSTEM` entrava como `USER` e perdia Gestão de Acessos.
      unsubscribers.push(onSnapshot(
        doc(db, REGISTRATION_REFUSALS_COLLECTION, userId),
        (snap) => {
          if (snap.exists()) settle(() => reject(new LocalizedError(REGISTRATION_CLOSED_MESSAGE)));
        },
        () => undefined,
      ));
    });
  }

  async getUserByEmail(email: string): Promise<AppUser | null> {
    const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return fromDoc(d.id, d.data());
  }

  async getUsers(): Promise<AppUser[]> {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
  }

  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    await updateDoc(doc(db, 'users', userId), { role });
  }
}
