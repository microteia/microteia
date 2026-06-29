import type { ICaseNoteRepository } from '../../repositories/ICaseNoteRepository';
import type { CaseNote } from '../../entities';

export type GetCaseNotesUseCase = { execute: (tenantId: string, caseId: string) => Promise<CaseNote[]> };
export const makeGetCaseNotesUseCase = (repo: ICaseNoteRepository): GetCaseNotesUseCase => ({
  execute: (tenantId, caseId) => repo.getNotes(tenantId, caseId),
});
