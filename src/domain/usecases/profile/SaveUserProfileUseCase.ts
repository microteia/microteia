import type { IUserProfileRepository } from '../../repositories/IUserProfileRepository';
import type { UserProfile } from '../../entities';

export type SaveUserProfileUseCase = {
  execute: (userId: string, data: Omit<UserProfile, 'id' | 'userId' | 'nickname' | 'nicknameSetAt'>) => Promise<UserProfile>;
};

export const makeSaveUserProfileUseCase = (repo: IUserProfileRepository): SaveUserProfileUseCase => ({
  execute: (userId, data) => repo.saveProfile(userId, data),
});
