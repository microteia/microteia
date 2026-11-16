import type { IRegistrationPolicyRepository } from '../../repositories/IRegistrationPolicyRepository';

export type SetDefaultExtensionUseCase = {
  execute: (pluginId: string, isDefault: boolean, updatedBy: string) => Promise<void>;
};

export const makeSetDefaultExtensionUseCase = (repo: IRegistrationPolicyRepository): SetDefaultExtensionUseCase => ({
  execute: (pluginId, isDefault, updatedBy) => repo.setDefaultExtension(pluginId, isDefault, updatedBy),
});
