import type { Contract } from '../../entities';
import type { IContractRepository } from '../../repositories/IContractRepository';

export type SubscribeToContractsUseCase = {
  execute: (tenantId: string, onUpdate: (contracts: Contract[]) => void) => () => void;
};

export const makeSubscribeToContractsUseCase = (repo: IContractRepository): SubscribeToContractsUseCase => ({
  execute: (tenantId, onUpdate) => repo.subscribeToContracts(tenantId, onUpdate),
});
