import type { IContractNoteRepository } from '../../repositories/IContractNoteRepository';

export type DeleteContractNoteUseCase = {
  execute: (tenantId: string, contractId: string, noteId: string) => Promise<void>;
};

export const makeDeleteContractNoteUseCase = (repo: IContractNoteRepository): DeleteContractNoteUseCase => ({
  execute: (tenantId, contractId, noteId) => repo.deleteNote(tenantId, contractId, noteId),
});
