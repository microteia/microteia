import type { Contract } from '../../entities';
import type { IContractRepository } from '../../repositories/IContractRepository';

export type CreateContractUseCase = {
  execute: (tenantId: string, data: Omit<Contract, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<Contract>;
};

export const makeCreateContractUseCase = (repo: IContractRepository): CreateContractUseCase => ({
  execute: (tenantId, data) => repo.createContract(tenantId, data),
});
