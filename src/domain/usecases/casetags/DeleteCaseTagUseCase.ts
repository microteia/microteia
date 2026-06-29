import type { ICaseTagRepository } from '../../repositories/ICaseTagRepository';

export type DeleteCaseTagUseCase = { execute: (tenantId: string, tagId: string) => Promise<void> };
export const makeDeleteCaseTagUseCase = (repo: ICaseTagRepository): DeleteCaseTagUseCase => ({
  execute: (tenantId, tagId) => repo.deleteCaseTag(tenantId, tagId),
});
