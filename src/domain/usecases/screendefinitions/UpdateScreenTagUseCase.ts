import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';

export type UpdateScreenTagUseCase = {
  execute: (tenantId: string, screenKey: string, tagId: string, data: { name: string; color: string }) => Promise<void>;
};

export const makeUpdateScreenTagUseCase = (repo: IScreenDefinitionRepository): UpdateScreenTagUseCase => ({
  execute: (tenantId, screenKey, tagId, data) => repo.updateTag(tenantId, screenKey, tagId, data),
});
