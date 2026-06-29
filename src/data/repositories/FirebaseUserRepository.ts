import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
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

  async createUserProfile(
    userId: string,
    data: Pick<AppUser, 'email' | 'displayName' | 'photoURL'>,
  ): Promise<AppUser> {
    const ref = doc(db, 'users', userId);
    await setDoc(ref, {
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      role: 'USER' as UserRole,
      createdAt: serverTimestamp(),
    });
    return { id: userId, ...data, role: 'USER', createdAt: new Date() };
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
