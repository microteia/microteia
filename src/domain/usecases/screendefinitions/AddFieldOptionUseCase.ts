import type { ScreenFieldOption } from '../../entities';
import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';

export type AddFieldOptionUseCase = {
  execute: (tenantId: string, screenKey: string, fieldKey: string, label: string, userId: string) => Promise<ScreenFieldOption>;
};

export const makeAddFieldOptionUseCase = (repo: IScreenDefinitionRepository): AddFieldOptionUseCase => ({
  execute: (tenantId, screenKey, fieldKey, label, userId) => repo.addFieldOption(tenantId, screenKey, fieldKey, label, userId),
});
