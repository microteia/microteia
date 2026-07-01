import type { IContractTagRepository } from '../../repositories/IContractTagRepository';

export type UpdateContractTagUseCase = {
  execute: (tenantId: string, tagId: string, data: { name: string; color: string }) => Promise<void>;
};

export const makeUpdateContractTagUseCase = (repo: IContractTagRepository): UpdateContractTagUseCase => ({
  execute: (tenantId, tagId, data) => repo.updateContractTag(tenantId, tagId, data),
});
