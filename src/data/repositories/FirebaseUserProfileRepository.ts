import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../../infrastructure/firebase/config';
import type { UserProfile, Gender, NicknameCheckResult } from '../../domain/entities';
import type { IUserProfileRepository } from '../../domain/repositories/IUserProfileRepository';

const fromDoc = (userId: string, data: Record<string, unknown>): UserProfile => ({
  id: userId,
  userId,
  fullName: data.fullName as string | undefined,
  nickname: data.nickname as string | undefined,
  nicknameSetAt: data.nicknameSetAt ? (data.nicknameSetAt as { toDate(): Date }).toDate() : undefined,
  phone: data.phone as string | undefined,
  gender: data.gender as Gender | undefined,
  birthDate: data.birthDate ? (data.birthDate as { toDate(): Date }).toDate() : undefined,
  photoURL: data.photoURL as string | null | undefined,
});

export class FirebaseUserProfileRepository implements IUserProfileRepository {
  async getProfile(userId: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(db, 'userProfiles', userId));
    if (!snap.exists()) return null;
    return fromDoc(userId, snap.data());
  }

  async saveProfile(userId: string, data: Omit<UserProfile, 'id' | 'userId' | 'nickname' | 'nicknameSetAt'>): Promise<UserProfile> {
    const docRef = doc(db, 'userProfiles', userId);
    const payload: Record<string, unknown> = { userId };
    if (data.fullName !== undefined) payload.fullName = data.fullName ?? null;
    if (data.phone !== undefined) payload.phone = data.phone ?? null;
    if (data.gender !== undefined) payload.gender = data.gender ?? null;
    if (data.birthDate !== undefined) payload.birthDate = data.birthDate ?? null;
    if (data.photoURL !== undefined) payload.photoURL = data.photoURL ?? null;
    await setDoc(docRef, payload, { merge: true });
    return { id: userId, userId, ...data };
  }

  /**
   * `userPhotos/{userId}/…` é o ÚNICO prefixo que o `storage.rules` libera para a foto de perfil (dono
   * escreve, até 5 MB, `image/*`). Enquanto isto gravava em `users/{userId}/profile-photos/`, nenhuma
   * regra casava o caminho e o upload caía no `allow read, write: if false` do curinga final — a troca
   * de foto falhava com `storage/unauthorized`. As fotos já gravadas no caminho antigo continuam
   * abrindo: o que fica em `photoURL` é a URL de download, que carrega o próprio token.
   */
  async uploadPhoto(userId: string, blob: Blob, fileName: string): Promise<string> {
    const storageRef = ref(storage, `userPhotos/${userId}/${fileName}`);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(storageRef);
  }

  async checkNicknameAvailability(nickname: string): Promise<NicknameCheckResult> {
    const fn = httpsCallable<{ nickname: string }, NicknameCheckResult>(functions, 'checkNicknameAvailability');
    const result = await fn({ nickname });
    return result.data;
  }

  async claimNickname(nickname: string): Promise<void> {
    const fn = httpsCallable<{ nickname: string }, { success: boolean }>(functions, 'claimNickname');
    await fn({ nickname });
  }
}
