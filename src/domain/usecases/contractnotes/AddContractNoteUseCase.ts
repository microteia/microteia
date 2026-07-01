import type { IContractNoteRepository } from '../../repositories/IContractNoteRepository';
import type { ContractNote } from '../../entities';

export type AddContractNoteUseCase = {
  execute: (tenantId: string, contractId: string, data: Omit<ContractNote, 'id' | 'contractId' | 'tenantId' | 'createdAt'>) => Promise<ContractNote>;
};

export const makeAddContractNoteUseCase = (repo: IContractNoteRepository): AddContractNoteUseCase => ({
  execute: (tenantId, contractId, data) => repo.addNote(tenantId, contractId, data),
});
