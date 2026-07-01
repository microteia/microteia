import type { Contract } from '../../entities';
import type { IContractRepository } from '../../repositories/IContractRepository';

export type GetContractsUseCase = {
  execute: (tenantId: string) => Promise<Contract[]>;
};

export const makeGetContractsUseCase = (repo: IContractRepository): GetContractsUseCase => ({
  execute: (tenantId) => repo.getContracts(tenantId),
});
