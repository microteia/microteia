import type { IUserProfileRepository } from '../../repositories/IUserProfileRepository';
import type { NicknameCheckResult } from '../../entities';

export type CheckNicknameAvailabilityUseCase = {
  execute: (nickname: string) => Promise<NicknameCheckResult>;
};

export const makeCheckNicknameAvailabilityUseCase = (repo: IUserProfileRepository): CheckNicknameAvailabilityUseCase => ({
  execute: (nickname) => repo.checkNicknameAvailability(nickname),
});
