import type { IContractNoteRepository } from '../../repositories/IContractNoteRepository';
import type { ContractNote } from '../../entities';

export type GetContractNotesUseCase = {
  execute: (tenantId: string, contractId: string) => Promise<ContractNote[]>;
};

export const makeGetContractNotesUseCase = (repo: IContractNoteRepository): GetContractNotesUseCase => ({
  execute: (tenantId, contractId) => repo.getNotes(tenantId, contractId),
});
