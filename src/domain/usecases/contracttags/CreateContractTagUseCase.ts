import type { IContractTagRepository } from '../../repositories/IContractTagRepository';
import type { ContractTag } from '../../entities';

export type CreateContractTagUseCase = {
  execute: (tenantId: string, data: Omit<ContractTag, 'id' | 'tenantId' | 'createdAt'>) => Promise<ContractTag>;
};

export const makeCreateContractTagUseCase = (repo: IContractTagRepository): CreateContractTagUseCase => ({
  execute: (tenantId, data) => repo.createContractTag(tenantId, data),
});
