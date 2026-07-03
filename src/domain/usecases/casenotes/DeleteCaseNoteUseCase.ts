import type { ICaseNoteRepository } from '../../repositories/ICaseNoteRepository';
import type { DeletionActor } from '../../entities';

export type DeleteCaseNoteUseCase = { execute: (tenantId: string, caseId: string, noteId: string, actor: DeletionActor) => Promise<void> };
export const makeDeleteCaseNoteUseCase = (repo: ICaseNoteRepository): DeleteCaseNoteUseCase => ({
  execute: (tenantId, caseId, noteId, actor) => repo.deleteNote(tenantId, caseId, noteId, actor),
});
