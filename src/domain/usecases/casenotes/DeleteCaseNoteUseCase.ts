import type { ICaseNoteRepository } from '../../repositories/ICaseNoteRepository';

export type DeleteCaseNoteUseCase = { execute: (tenantId: string, caseId: string, noteId: string) => Promise<void> };
export const makeDeleteCaseNoteUseCase = (repo: ICaseNoteRepository): DeleteCaseNoteUseCase => ({
  execute: (tenantId, caseId, noteId) => repo.deleteNote(tenantId, caseId, noteId),
});
