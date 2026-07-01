import type { IContractRepository } from '../../repositories/IContractRepository';

export type DeleteContractUseCase = {
  execute: (tenantId: string, contractId: string) => Promise<void>;
};

export const makeDeleteContractUseCase = (repo: IContractRepository): DeleteContractUseCase => ({
  execute: (tenantId, contractId) => repo.deleteContract(tenantId, contractId),
});
