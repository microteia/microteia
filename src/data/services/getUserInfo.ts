import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';

export interface UserInfo {
  displayName: string;
  photoURL: string | null;
}

const fn = httpsCallable<{ userId: string }, UserInfo>(functions, 'getUserInfo');

export const fetchUserInfo = async (userId: string): Promise<UserInfo> => {
  const result = await fn({ userId });
  return result.data;
};
