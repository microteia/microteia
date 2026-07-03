import type { IPersonNoteRepository } from '../../repositories/IPersonNoteRepository';
import type { DeletionActor } from '../../entities';

export type DeletePersonNoteUseCase = {
  execute: (tenantId: string, personId: string, noteId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeletePersonNoteUseCase = (repo: IPersonNoteRepository): DeletePersonNoteUseCase => ({
  execute: (tenantId, personId, noteId, actor) => repo.deleteNote(tenantId, personId, noteId, actor),
});
