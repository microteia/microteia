import type { DeletionActor } from '../../entities';
import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';

export type DeleteScreenTagUseCase = {
  execute: (tenantId: string, screenKey: string, tagId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteScreenTagUseCase = (repo: IScreenDefinitionRepository): DeleteScreenTagUseCase => ({
  execute: (tenantId, screenKey, tagId, actor) => repo.deleteTag(tenantId, screenKey, tagId, actor),
});
