import type { Financial } from '../../entities';
import type { IFinancialRepository } from '../../repositories/IFinancialRepository';

export type GetFinancialsUseCase = {
  execute: (tenantId: string) => Promise<Financial[]>;
};

export const makeGetFinancialsUseCase = (repo: IFinancialRepository): GetFinancialsUseCase => ({
  execute: (tenantId) => repo.getFinancials(tenantId),
});
