import type { IAuthRepository } from '../../repositories/IAuthRepository';

export type SignOutUseCase = { execute: () => Promise<void> };

export const makeSignOutUseCase = (repo: IAuthRepository): SignOutUseCase => ({
  execute: () => repo.signOut(),
});
