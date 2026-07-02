import type { IFinancialTagRepository } from '../../repositories/IFinancialTagRepository';

export type UpdateFinancialTagUseCase = {
  execute: (tenantId: string, tagId: string, data: { name: string; color: string }) => Promise<void>;
};

export const makeUpdateFinancialTagUseCase = (repo: IFinancialTagRepository): UpdateFinancialTagUseCase => ({
  execute: (tenantId, tagId, data) => repo.updateFinancialTag(tenantId, tagId, data),
});
