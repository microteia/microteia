import type { ICaseRepository } from '../../repositories/ICaseRepository';

export type DeleteCaseUseCase = {
  execute: (tenantId: string, caseId: string) => Promise<void>;
};

export const makeDeleteCaseUseCase = (repo: ICaseRepository): DeleteCaseUseCase => ({
  execute: (tenantId, caseId) => repo.deleteCase(tenantId, caseId),
});
