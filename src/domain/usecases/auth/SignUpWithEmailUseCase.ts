import type { IAuthRepository } from '../../repositories/IAuthRepository';
import type { User } from '../../entities';

export type SignUpWithEmailUseCase = { execute: (email: string, password: string, displayName: string) => Promise<User> };

export const makeSignUpWithEmailUseCase = (repo: IAuthRepository): SignUpWithEmailUseCase => ({
  execute: (email, password, displayName) => repo.signUpWithEmail(email, password, displayName),
});
