import type { IExtensionOnboardingRepository } from '../../repositories/IExtensionOnboardingRepository';
import type { DefaultExtensionsOnboarding } from '../../schema/plugin/defaultExtensions';

export type SubscribeDefaultExtensionsOnboardingUseCase = {
  execute: (
    tenantId: string,
    onChange: (onboarding: DefaultExtensionsOnboarding | null) => void,
    onError: (error: Error) => void,
  ) => () => void;
};

export const makeSubscribeDefaultExtensionsOnboardingUseCase = (
  repo: IExtensionOnboardingRepository,
): SubscribeDefaultExtensionsOnboardingUseCase => ({
  execute: (tenantId, onChange, onError) => repo.subscribe(tenantId, onChange, onError),
});

export type SettleDefaultExtensionUseCase = {
  execute: (tenantId: string, pluginId: string, outcome: 'installed' | 'deferred') => Promise<void>;
};

export const makeSettleDefaultExtensionUseCase = (repo: IExtensionOnboardingRepository): SettleDefaultExtensionUseCase => ({
  execute: (tenantId, pluginId, outcome) => repo.settle(tenantId, pluginId, outcome),
});
