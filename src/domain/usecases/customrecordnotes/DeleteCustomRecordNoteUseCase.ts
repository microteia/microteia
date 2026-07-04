import type { ICustomRecordNoteRepository } from '../../repositories/ICustomRecordNoteRepository';
import type { DeletionActor } from '../../entities';

export type DeleteCustomRecordNoteUseCase = {
  execute: (tenantId: string, recordId: string, noteId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteCustomRecordNoteUseCase = (repo: ICustomRecordNoteRepository): DeleteCustomRecordNoteUseCase => ({
  execute: (tenantId, recordId, noteId, actor) => repo.deleteNote(tenantId, recordId, noteId, actor),
});
