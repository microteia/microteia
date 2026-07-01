import type { IContractRepository } from '../../repositories/IContractRepository';
import type { ICaseRepository } from '../../repositories/ICaseRepository';

export type DeleteContractUseCase = {
  execute: (tenantId: string, contractId: string) => Promise<void>;
};

export const makeDeleteContractUseCase = (
  repo: IContractRepository,
  caseRepo: ICaseRepository,
): DeleteContractUseCase => ({
  execute: async (tenantId, contractId) => {
    await caseRepo.unlinkCasesFromContract(tenantId, contractId);
    await repo.deleteContract(tenantId, contractId);
  },
});
