import type { IAuthRepository } from '../../repositories/IAuthRepository';
import type { User } from '../../entities';

export type SignInWithEmailUseCase = { execute: (email: string, password: string) => Promise<User> };

export const makeSignInWithEmailUseCase = (repo: IAuthRepository): SignInWithEmailUseCase => ({
  execute: (email, password) => repo.signInWithEmail(email, password),
});
