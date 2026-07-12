import type { IContractRepository } from '../../repositories/IContractRepository';
import type { DeletionActor } from '../../entities';

export type DeleteContractUseCase = {
  execute: (tenantId: string, contractId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteContractUseCase = (repo: IContractRepository): DeleteContractUseCase => ({
  execute: (tenantId, contractId, actor) => repo.deleteContract(tenantId, contractId, actor),
});
