import type { NicknameAvailability, NicknameData } from '../entities/NicknameInfo';

export interface INicknameRepository {
  checkAvailability(nickname: string, userId: string): Promise<NicknameAvailability>;
  claim(nickname: string, userId: string): Promise<void>;
  getUserProfile(userId: string): Promise<{ nicknameSetAt?: Date } | null>;
}
