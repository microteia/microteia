import type { ICaseNoteRepository } from '../../repositories/ICaseNoteRepository';
import type { CaseNote } from '../../entities';

export type AddCaseNoteUseCase = { execute: (tenantId: string, caseId: string, data: Omit<CaseNote, 'id' | 'caseId' | 'tenantId' | 'createdAt'>) => Promise<CaseNote> };
export const makeAddCaseNoteUseCase = (repo: ICaseNoteRepository): AddCaseNoteUseCase => ({
  execute: (tenantId, caseId, data) => repo.addNote(tenantId, caseId, data),
});
