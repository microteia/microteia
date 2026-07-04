import type { CustomRecordTag } from '../../entities';
import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';

export type CreateScreenTagUseCase = {
  execute: (tenantId: string, screenKey: string, data: Omit<CustomRecordTag, 'id' | 'tenantId' | 'screenKey' | 'createdAt'>) => Promise<CustomRecordTag>;
};

export const makeCreateScreenTagUseCase = (repo: IScreenDefinitionRepository): CreateScreenTagUseCase => ({
  execute: (tenantId, screenKey, data) => repo.createTag(tenantId, screenKey, data),
});
