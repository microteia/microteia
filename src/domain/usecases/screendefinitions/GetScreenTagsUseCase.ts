import type { ScreenTag } from '../../entities';
import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';

export type GetScreenTagsUseCase = {
  execute: (tenantId: string, screenKey: string) => Promise<ScreenTag[]>;
};

export const makeGetScreenTagsUseCase = (repo: IScreenDefinitionRepository): GetScreenTagsUseCase => ({
  execute: (tenantId, screenKey) => repo.getTags(tenantId, screenKey),
});
