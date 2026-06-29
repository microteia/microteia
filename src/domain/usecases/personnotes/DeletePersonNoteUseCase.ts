import type { IPersonNoteRepository } from '../../repositories/IPersonNoteRepository';

export type DeletePersonNoteUseCase = {
  execute: (tenantId: string, personId: string, noteId: string) => Promise<void>;
};

export const makeDeletePersonNoteUseCase = (repo: IPersonNoteRepository): DeletePersonNoteUseCase => ({
  execute: (tenantId, personId, noteId) => repo.deleteNote(tenantId, personId, noteId),
});
