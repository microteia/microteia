import type { CaseNote } from '../entities';

export interface ICaseNoteRepository {
  getNotes(tenantId: string, caseId: string): Promise<CaseNote[]>;
  addNote(tenantId: string, caseId: string, data: Omit<CaseNote, 'id' | 'caseId' | 'tenantId' | 'createdAt'>): Promise<CaseNote>;
  deleteNote(tenantId: string, caseId: string, noteId: string): Promise<void>;
}
