import type { IAuthRepository } from '../../repositories/IAuthRepository';
import type { User } from '../../entities';

export type SendSignInLinkUseCase = { execute: (email: string, continueUrl: string, locale?: string) => Promise<void> };

export const makeSendSignInLinkUseCase = (repo: IAuthRepository): SendSignInLinkUseCase => ({
  execute: (email, continueUrl, locale) => repo.sendSignInLink(email, continueUrl, locale),
});

export type SignInWithLinkUseCase = {
  isSignInLink: (url: string) => boolean;
  execute: (email: string, url: string) => Promise<User>;
};

export const makeSignInWithLinkUseCase = (repo: IAuthRepository): SignInWithLinkUseCase => ({
  isSignInLink: (url) => repo.isSignInLink(url),
  execute: (email, url) => repo.signInWithLink(email, url),
});
