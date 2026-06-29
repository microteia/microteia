import type { ICaseTagRepository } from '../../repositories/ICaseTagRepository';

export type UpdateCaseTagUseCase = { execute: (tenantId: string, tagId: string, data: { name: string; color: string }) => Promise<void> };
export const makeUpdateCaseTagUseCase = (repo: ICaseTagRepository): UpdateCaseTagUseCase => ({
  execute: (tenantId, tagId, data) => repo.updateCaseTag(tenantId, tagId, data),
});
