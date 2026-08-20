import type { UserProfile, NicknameCheckResult } from '../entities';

export interface IUserProfileRepository {
  getProfile(userId: string): Promise<UserProfile | null>;
  saveProfile(userId: string, data: Omit<UserProfile, 'id' | 'userId' | 'nickname' | 'nicknameSetAt'>): Promise<UserProfile>;
  uploadPhoto(userId: string, blob: Blob, fileName: string): Promise<string>;
  checkNicknameAvailability(nickname: string): Promise<NicknameCheckResult>;
  claimNickname(nickname: string): Promise<void>;
}
