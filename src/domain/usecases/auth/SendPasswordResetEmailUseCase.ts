import type { IAuthRepository } from '../../repositories/IAuthRepository';

export type SendPasswordResetEmailUseCase = { execute: (email: string) => Promise<void> };

export const makeSendPasswordResetEmailUseCase = (repo: IAuthRepository): SendPasswordResetEmailUseCase => ({
  execute: (email) => repo.sendPasswordResetEmail(email),
});
