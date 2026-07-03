import type { IContractRepository } from '../../repositories/IContractRepository';
import type { ICaseRepository } from '../../repositories/ICaseRepository';
import type { IFinancialRepository } from '../../repositories/IFinancialRepository';
import type { DeletionActor } from '../../entities';

export type DeleteContractUseCase = {
  execute: (tenantId: string, contractId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteContractUseCase = (
  repo: IContractRepository,
  caseRepo: ICaseRepository,
  financialRepo: IFinancialRepository,
): DeleteContractUseCase => ({
  execute: async (tenantId, contractId, actor) => {
    await caseRepo.unlinkCasesFromContract(tenantId, contractId);
    await financialRepo.unlinkFinancialsFromContract(tenantId, contractId);
    await repo.deleteContract(tenantId, contractId, actor);
  },
});
