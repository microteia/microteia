import type { IFinancialTagRepository } from '../../repositories/IFinancialTagRepository';

export type DeleteFinancialTagUseCase = {
  execute: (tenantId: string, tagId: string) => Promise<void>;
};

export const makeDeleteFinancialTagUseCase = (repo: IFinancialTagRepository): DeleteFinancialTagUseCase => ({
  execute: (tenantId, tagId) => repo.deleteFinancialTag(tenantId, tagId),
});
