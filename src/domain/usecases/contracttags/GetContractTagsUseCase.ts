import type { IContractTagRepository } from '../../repositories/IContractTagRepository';
import type { ContractTag } from '../../entities';

export type GetContractTagsUseCase = {
  execute: (tenantId: string) => Promise<ContractTag[]>;
};

export const makeGetContractTagsUseCase = (repo: IContractTagRepository): GetContractTagsUseCase => ({
  execute: (tenantId) => repo.getContractTags(tenantId),
});
