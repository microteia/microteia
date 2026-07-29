import type { ScreenTag } from '../../entities';
import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';

export type CreateScreenTagUseCase = {
  execute: (tenantId: string, screenKey: string, data: Omit<ScreenTag, 'id' | 'tenantId' | 'screenKey' | 'createdAt'>) => Promise<ScreenTag>;
};

export const makeCreateScreenTagUseCase = (repo: IScreenDefinitionRepository): CreateScreenTagUseCase => ({
  execute: (tenantId, screenKey, data) => repo.createTag(tenantId, screenKey, data),
});
