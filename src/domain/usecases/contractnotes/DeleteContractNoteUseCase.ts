import type { IContractNoteRepository } from '../../repositories/IContractNoteRepository';
import type { DeletionActor } from '../../entities';

export type DeleteContractNoteUseCase = {
  execute: (tenantId: string, contractId: string, noteId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteContractNoteUseCase = (repo: IContractNoteRepository): DeleteContractNoteUseCase => ({
  execute: (tenantId, contractId, noteId, actor) => repo.deleteNote(tenantId, contractId, noteId, actor),
});
