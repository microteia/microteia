import type { Firestore } from 'firebase-admin/firestore';
import type { IUserProfileLookupService, ResolvedActor } from '../../domain/repositories/IUserProfileLookupService';

/**
 * Ordem de prioridade oficial do "nome efetivo" de um usuário em todo o sistema
 * (espelha `effectiveName` do frontend, em `src/stores/AuthContext.tsx`):
 * userProfiles.nickname > userProfiles.fullName > users.displayName > users.email.
 */
export class UserProfileLookupService implements IUserProfileLookupService {
  constructor(private readonly db: Firestore) {}

  async resolveActor(uid: string): Promise<ResolvedActor> {
    if (!uid) return { name: 'Sistema', photoURL: '' };
    const identity = await this.resolveIdentity(uid);
    return { name: identity.name || '@core.workspace/user.unknown', photoURL: identity.photoURL };
  }

  async resolveIdentity(uid: string): Promise<ResolvedActor> {
    if (!uid) return { name: '', photoURL: '' };

    const [profileData, userData] = await Promise.all([
      this.db.collection('userProfiles').doc(uid).get()
        .then((snap) => (snap.exists ? snap.data() as Record<string, unknown> : null))
        .catch(() => null),
      this.db.collection('users').doc(uid).get()
        .then((snap) => (snap.exists ? snap.data() as Record<string, unknown> : null))
        .catch(() => null),
    ]);

    const nickname = profileData?.nickname as string | undefined;
    const fullName = profileData?.fullName as string | undefined;
    const displayName = userData?.displayName as string | undefined;
    const email = userData?.email as string | undefined;

    const name = nickname || fullName || displayName || email || '';
    const photoURL = (profileData?.photoURL as string | undefined)
      || (userData?.photoURL as string | undefined)
      || '';

    return { name, photoURL };
  }
}
