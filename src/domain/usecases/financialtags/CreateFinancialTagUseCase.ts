import type { IFinancialTagRepository } from '../../repositories/IFinancialTagRepository';
import type { FinancialTag } from '../../entities';

export type CreateFinancialTagUseCase = {
  execute: (tenantId: string, data: Omit<FinancialTag, 'id' | 'tenantId' | 'createdAt'>) => Promise<FinancialTag>;
};

export const makeCreateFinancialTagUseCase = (repo: IFinancialTagRepository): CreateFinancialTagUseCase => ({
  execute: (tenantId, data) => repo.createFinancialTag(tenantId, data),
});
