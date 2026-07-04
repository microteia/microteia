import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';

export type RemoveFieldOptionUseCase = {
  execute: (tenantId: string, screenKey: string, optionId: string) => Promise<void>;
};

export const makeRemoveFieldOptionUseCase = (repo: IScreenDefinitionRepository): RemoveFieldOptionUseCase => ({
  execute: (tenantId, screenKey, optionId) => repo.removeFieldOption(tenantId, screenKey, optionId),
});
