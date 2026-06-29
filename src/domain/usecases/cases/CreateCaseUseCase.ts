import type { Case } from '../../entities';
import type { ICaseRepository } from '../../repositories/ICaseRepository';

export type CreateCaseUseCase = {
  execute: (tenantId: string, data: Omit<Case, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<Case>;
};

export const makeCreateCaseUseCase = (repo: ICaseRepository): CreateCaseUseCase => ({
  execute: (tenantId, data) => repo.createCase(tenantId, data),
});
