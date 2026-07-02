import type { IFinancialTagRepository } from '../../repositories/IFinancialTagRepository';
import type { FinancialTag } from '../../entities';

export type GetFinancialTagsUseCase = {
  execute: (tenantId: string) => Promise<FinancialTag[]>;
};

export const makeGetFinancialTagsUseCase = (repo: IFinancialTagRepository): GetFinancialTagsUseCase => ({
  execute: (tenantId) => repo.getFinancialTags(tenantId),
});
