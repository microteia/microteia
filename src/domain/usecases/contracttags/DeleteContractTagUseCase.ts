import type { IContractTagRepository } from '../../repositories/IContractTagRepository';
import type { DeletionActor } from '../../entities';

export type DeleteContractTagUseCase = {
  execute: (tenantId: string, tagId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteContractTagUseCase = (repo: IContractTagRepository): DeleteContractTagUseCase => ({
  execute: (tenantId, tagId, actor) => repo.deleteContractTag(tenantId, tagId, actor),
});
