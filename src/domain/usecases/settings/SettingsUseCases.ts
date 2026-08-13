import type { ISettingsRepository } from '../../repositories/ISettingsRepository';
import type { SettingsScope, SettingsValues } from '../../schema/settings';

export type SubscribeSettingsUseCase = {
  execute: (
    tenantId: string,
    userId: string,
    onChange: (scope: SettingsScope, values: SettingsValues) => void,
  ) => () => void;
};

export const makeSubscribeSettingsUseCase = (repo: ISettingsRepository): SubscribeSettingsUseCase => ({
  execute: (tenantId, userId, onChange) => repo.subscribe(tenantId, userId, onChange),
});

export type SaveSettingsUseCase = {
  execute: (
    tenantId: string,
    userId: string,
    scope: SettingsScope,
    values: SettingsValues,
  ) => Promise<void>;
};

export const makeSaveSettingsUseCase = (repo: ISettingsRepository): SaveSettingsUseCase => ({
  execute: (tenantId, userId, scope, values) => repo.save(tenantId, userId, scope, values),
});
