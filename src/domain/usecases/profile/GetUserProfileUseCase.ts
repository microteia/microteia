import type { IUserProfileRepository } from '../../repositories/IUserProfileRepository';
import type { UserProfile } from '../../entities';

export type GetUserProfileUseCase = {
  execute: (userId: string) => Promise<UserProfile | null>;
};

export const makeGetUserProfileUseCase = (repo: IUserProfileRepository): GetUserProfileUseCase => ({
  execute: (userId) => repo.getProfile(userId),
});
