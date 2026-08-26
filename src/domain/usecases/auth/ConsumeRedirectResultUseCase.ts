import type { IAuthRepository } from '../../repositories/IAuthRepository';
import type { User } from '../../entities';

export type ConsumeRedirectResultUseCase = { execute: () => Promise<User | null> };

export const makeConsumeRedirectResultUseCase = (repo: IAuthRepository): ConsumeRedirectResultUseCase => ({
  execute: () => repo.consumeRedirectResult(),
});
