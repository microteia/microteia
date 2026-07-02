import type { IContractRepository } from '../../repositories/IContractRepository';
import type { ICaseRepository } from '../../repositories/ICaseRepository';
import type { IFinancialRepository } from '../../repositories/IFinancialRepository';

export type DeleteContractUseCase = {
  execute: (tenantId: string, contractId: string) => Promise<void>;
};

export const makeDeleteContractUseCase = (
  repo: IContractRepository,
  caseRepo: ICaseRepository,
  financialRepo: IFinancialRepository,
): DeleteContractUseCase => ({
  execute: async (tenantId, contractId) => {
    await caseRepo.unlinkCasesFromContract(tenantId, contractId);
    await financialRepo.unlinkFinancialsFromContract(tenantId, contractId);
    await repo.deleteContract(tenantId, contractId);
  },
});
