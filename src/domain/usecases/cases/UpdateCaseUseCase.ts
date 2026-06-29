import type { Case, CaseStatus } from '../../entities';
import type { ICaseRepository } from '../../repositories/ICaseRepository';

export type UpdateCaseUseCase = {
  execute: (tenantId: string, caseId: string, data: Partial<Omit<Case, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => Promise<void>;
};

export type UpdateCaseStatusUseCase = {
  execute: (tenantId: string, caseId: string, status: CaseStatus) => Promise<void>;
};

export const makeUpdateCaseUseCase = (repo: ICaseRepository): UpdateCaseUseCase => ({
  execute: (tenantId, caseId, data) => repo.updateCase(tenantId, caseId, data),
});

export const makeUpdateCaseStatusUseCase = (repo: ICaseRepository): UpdateCaseStatusUseCase => ({
  execute: (tenantId, caseId, status) => repo.updateCaseStatus(tenantId, caseId, status),
});
