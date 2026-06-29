import type { IFinancialRepository } from '../../repositories/IFinancialRepository';

export type DeleteFinancialUseCase = {
  execute: (tenantId: string, financialId: string) => Promise<void>;
};

export const makeDeleteFinancialUseCase = (repo: IFinancialRepository): DeleteFinancialUseCase => ({
  execute: (tenantId, financialId) => repo.deleteFinancial(tenantId, financialId),
});
