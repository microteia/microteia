import type { IAuthRepository } from '../../repositories/IAuthRepository';

export type SendEmailVerificationUseCase = { execute: () => Promise<void> };

export const makeSendEmailVerificationUseCase = (repo: IAuthRepository): SendEmailVerificationUseCase => ({
  execute: () => repo.sendEmailVerification(),
});
