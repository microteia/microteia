import type { IUserRepository } from '../repositories/IUserRepository';
import type { UserInfo } from '../entities/UserInfo';

export type GetUserInfoUseCase = {
  execute: (userId: string) => Promise<UserInfo>;
};

export const makeGetUserInfoUseCase = (
  userRepository: IUserRepository,
): GetUserInfoUseCase => ({
  execute: (userId: string) => userRepository.getUserInfo(userId),
});
