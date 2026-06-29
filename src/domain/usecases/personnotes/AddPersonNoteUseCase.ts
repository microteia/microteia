import type { IPersonNoteRepository } from '../../repositories/IPersonNoteRepository';
import type { PersonNote } from '../../entities';

export type AddPersonNoteUseCase = {
  execute: (tenantId: string, personId: string, data: Omit<PersonNote, 'id' | 'personId' | 'tenantId' | 'createdAt'>) => Promise<PersonNote>;
};

export const makeAddPersonNoteUseCase = (repo: IPersonNoteRepository): AddPersonNoteUseCase => ({
  execute: (tenantId, personId, data) => repo.addNote(tenantId, personId, data),
});
