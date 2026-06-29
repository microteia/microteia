import type { IAuthRepository } from '../../repositories/IAuthRepository';
import type { User } from '../../entities';

export type SignInWithFacebookUseCase = { execute: () => Promise<User> };

export const makeSignInWithFacebookUseCase = (repo: IAuthRepository): SignInWithFacebookUseCase => ({
  execute: () => repo.signInWithFacebook(),
});
