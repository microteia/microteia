import type { IUserProfileRepository } from '../../repositories/IUserProfileRepository';

export type ClaimNicknameUseCase = {
  execute: (nickname: string) => Promise<void>;
};

export const makeClaimNicknameUseCase = (repo: IUserProfileRepository): ClaimNicknameUseCase => ({
  execute: (nickname) => repo.claimNickname(nickname),
});
