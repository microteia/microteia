import type { PersonNote, DeletionActor } from '../entities';

export interface IPersonNoteRepository {
  getNotes(tenantId: string, personId: string): Promise<PersonNote[]>;
  addNote(tenantId: string, personId: string, data: Omit<PersonNote, 'id' | 'personId' | 'tenantId' | 'createdAt'>): Promise<PersonNote>;
  deleteNote(tenantId: string, personId: string, noteId: string, actor: DeletionActor): Promise<void>;
}
