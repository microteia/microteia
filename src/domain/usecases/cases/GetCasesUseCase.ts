import type { Case } from '../../entities';
import type { ICaseRepository } from '../../repositories/ICaseRepository';

export type GetCasesUseCase = {
  execute: (tenantId: string) => Promise<Case[]>;
};

export const makeGetCasesUseCase = (repo: ICaseRepository): GetCasesUseCase => ({
  execute: (tenantId) => repo.getCases(tenantId),
});
