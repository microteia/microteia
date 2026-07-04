import type { CustomRecordTag } from '../../entities';
import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';

export type GetScreenTagsUseCase = {
  execute: (tenantId: string, screenKey: string) => Promise<CustomRecordTag[]>;
};

export const makeGetScreenTagsUseCase = (repo: IScreenDefinitionRepository): GetScreenTagsUseCase => ({
  execute: (tenantId, screenKey) => repo.getTags(tenantId, screenKey),
});
