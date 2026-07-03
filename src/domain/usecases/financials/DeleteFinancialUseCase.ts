import type { IFinancialRepository } from '../../repositories/IFinancialRepository';
import type { DeletionActor } from '../../entities';

export type DeleteFinancialUseCase = {
  execute: (tenantId: string, financialId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteFinancialUseCase = (repo: IFinancialRepository): DeleteFinancialUseCase => ({
  execute: (tenantId, financialId, actor) => repo.deleteFinancial(tenantId, financialId, actor),
});
