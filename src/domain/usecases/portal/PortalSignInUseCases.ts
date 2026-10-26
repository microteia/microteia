import type { IPortalRepository } from '../../repositories/IPortalRepository';
import type { PortalSignInSettingsView } from '../../entities/Portal';
import type { PortalSignInOptions, PortalSignInSettings } from '../../schema/portalIdentity';

export type GetPortalSignInOptionsUseCase = {
  execute: (tenantId: string) => Promise<PortalSignInOptions>;
};

export const makeGetPortalSignInOptionsUseCase = (repo: IPortalRepository): GetPortalSignInOptionsUseCase => ({
  execute: (tenantId) => repo.getSignInOptions(tenantId),
});

export type StartPortalSignInUseCase = {
  execute: (input: Parameters<IPortalRepository['startSignIn']>[0]) => Promise<{ url: string; state: string }>;
};

export const makeStartPortalSignInUseCase = (repo: IPortalRepository): StartPortalSignInUseCase => ({
  execute: (input) => repo.startSignIn(input),
});

export type CompletePortalSignInUseCase = {
  execute: (state: string, code: string) => Promise<{ token: string; tenantId: string; next: string | null }>;
};

export const makeCompletePortalSignInUseCase = (repo: IPortalRepository): CompletePortalSignInUseCase => ({
  execute: (state, code) => repo.completeSignIn(state, code),
});

export type GetPortalSignInSettingsUseCase = {
  execute: (tenantId: string) => Promise<PortalSignInSettingsView>;
};

export const makeGetPortalSignInSettingsUseCase = (repo: IPortalRepository): GetPortalSignInSettingsUseCase => ({
  execute: (tenantId) => repo.getSignInSettings(tenantId),
});

export type SavePortalSignInSettingsUseCase = {
  execute: (
    tenantId: string,
    settings: PortalSignInSettings,
    secrets: Record<string, string | null>,
  ) => Promise<PortalSignInSettingsView>;
};

export const makeSavePortalSignInSettingsUseCase = (repo: IPortalRepository): SavePortalSignInSettingsUseCase => ({
  execute: (tenantId, settings, secrets) => repo.saveSignInSettings(tenantId, settings, secrets),
});
