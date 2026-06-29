import type { ICaseTagRepository } from '../../repositories/ICaseTagRepository';
import type { CaseTag } from '../../entities';

export type GetCaseTagsUseCase = { execute: (tenantId: string) => Promise<CaseTag[]> };
export const makeGetCaseTagsUseCase = (repo: ICaseTagRepository): GetCaseTagsUseCase => ({
  execute: (tenantId) => repo.getCaseTags(tenantId),
});
