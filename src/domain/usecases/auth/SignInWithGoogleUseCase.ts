import type { IAuthRepository } from '../../repositories/IAuthRepository';
import type { User } from '../../entities';

export type SignInWithGoogleUseCase = { execute: () => Promise<User> };

export const makeSignInWithGoogleUseCase = (repo: IAuthRepository): SignInWithGoogleUseCase => ({
  execute: () => repo.signInWithGoogle(),
});
