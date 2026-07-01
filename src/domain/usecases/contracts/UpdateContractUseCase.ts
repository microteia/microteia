import type { Contract } from '../../entities';
import type { IContractRepository } from '../../repositories/IContractRepository';

export type UpdateContractUseCase = {
  execute: (tenantId: string, contractId: string, data: Partial<Omit<Contract, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>) => Promise<void>;
};

export const makeUpdateContractUseCase = (repo: IContractRepository): UpdateContractUseCase => ({
  execute: (tenantId, contractId, data) => repo.updateContract(tenantId, contractId, data),
});
