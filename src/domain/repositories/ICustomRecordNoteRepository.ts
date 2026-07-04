import type { CustomRecordNote, DeletionActor } from '../entities';

export interface ICustomRecordNoteRepository {
  getNotes(tenantId: string, recordId: string): Promise<CustomRecordNote[]>;
  addNote(tenantId: string, recordId: string, data: Omit<CustomRecordNote, 'id' | 'recordId' | 'tenantId' | 'createdAt'>): Promise<CustomRecordNote>;
  deleteNote(tenantId: string, recordId: string, noteId: string, actor: DeletionActor): Promise<void>;
}
