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
      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        unsubscribe();
        reject(new Error('Tempo esgotado ao configurar sua conta. Recarregue a página para tentar novamente.'));
      }, timeoutMs);

      const unsubscribe = onSnapshot(
        doc(db, 'users', userId),
        (snap) => {
          if (settled || !snap.exists()) return;
          const data = snap.data();
          const tenantIds = (data.tenantIds as string[] | undefined) ?? [];
          if (tenantIds.length === 0) return;
          settled = true;
          clearTimeout(timeoutId);
          unsubscribe();
          resolve(fromDoc(snap.id, data));
        },
        (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          unsubscribe();
          reject(err);
        },
      );
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
