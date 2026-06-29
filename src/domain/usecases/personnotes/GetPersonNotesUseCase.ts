import type { IPersonNoteRepository } from '../../repositories/IPersonNoteRepository';
import type { PersonNote } from '../../entities';

export type GetPersonNotesUseCase = {
  execute: (tenantId: string, personId: string) => Promise<PersonNote[]>;
};

export const makeGetPersonNotesUseCase = (repo: IPersonNoteRepository): GetPersonNotesUseCase => ({
  execute: (tenantId, personId) => repo.getNotes(tenantId, personId),
});
