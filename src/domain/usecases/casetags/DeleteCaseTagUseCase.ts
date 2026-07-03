import type { ICaseTagRepository } from '../../repositories/ICaseTagRepository';
import type { DeletionActor } from '../../entities';

export type DeleteCaseTagUseCase = { execute: (tenantId: string, tagId: string, actor: DeletionActor) => Promise<void> };
export const makeDeleteCaseTagUseCase = (repo: ICaseTagRepository): DeleteCaseTagUseCase => ({
  execute: (tenantId, tagId, actor) => repo.deleteCaseTag(tenantId, tagId, actor),
});
