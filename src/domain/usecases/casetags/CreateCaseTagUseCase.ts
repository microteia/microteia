import type { ICaseTagRepository } from '../../repositories/ICaseTagRepository';
import type { CaseTag } from '../../entities';

export type CreateCaseTagUseCase = { execute: (tenantId: string, data: Omit<CaseTag, 'id' | 'tenantId' | 'createdAt'>) => Promise<CaseTag> };
export const makeCreateCaseTagUseCase = (repo: ICaseTagRepository): CreateCaseTagUseCase => ({
  execute: (tenantId, data) => repo.createCaseTag(tenantId, data),
});
