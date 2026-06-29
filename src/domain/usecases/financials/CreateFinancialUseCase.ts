import type { Financial } from '../../entities';
import type { IFinancialRepository } from '../../repositories/IFinancialRepository';

export type CreateFinancialUseCase = {
  execute: (tenantId: string, data: Omit<Financial, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<Financial>;
};

export const makeCreateFinancialUseCase = (repo: IFinancialRepository): CreateFinancialUseCase => ({
  execute: (tenantId, data) => repo.createFinancial(tenantId, data),
});
