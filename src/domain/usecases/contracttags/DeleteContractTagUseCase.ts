import type { IContractTagRepository } from '../../repositories/IContractTagRepository';

export type DeleteContractTagUseCase = {
  execute: (tenantId: string, tagId: string) => Promise<void>;
};

export const makeDeleteContractTagUseCase = (repo: IContractTagRepository): DeleteContractTagUseCase => ({
  execute: (tenantId, tagId) => repo.deleteContractTag(tenantId, tagId),
});
