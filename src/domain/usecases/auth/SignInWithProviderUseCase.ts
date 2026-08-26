import type { IAuthRepository } from '../../repositories/IAuthRepository';
import type { AuthProviderSpec } from '../../schema/auth';
import type { User } from '../../entities';

export type SignInWithProviderUseCase = {
  execute: (spec: AuthProviderSpec) => Promise<User | null>;
};

export const makeSignInWithProviderUseCase = (repo: IAuthRepository): SignInWithProviderUseCase => ({
  execute: (spec) => repo.signInWithProvider(spec),
});
