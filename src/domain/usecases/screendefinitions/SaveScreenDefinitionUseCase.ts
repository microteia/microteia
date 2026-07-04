import type { ScreenDefinition } from '../../entities';
import type { IScreenDefinitionRepository, ScreenDefinitionInput } from '../../repositories/IScreenDefinitionRepository';

export type SaveScreenDefinitionUseCase = {
  execute: (tenantId: string, screenKey: string, data: ScreenDefinitionInput) => Promise<ScreenDefinition>;
};

export const makeSaveScreenDefinitionUseCase = (repo: IScreenDefinitionRepository): SaveScreenDefinitionUseCase => ({
  execute: (tenantId, screenKey, data) => repo.upsert(tenantId, screenKey, data),
});
