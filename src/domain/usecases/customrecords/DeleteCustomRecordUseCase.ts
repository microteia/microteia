import type { DeletionActor } from '../../entities';
import type { ICustomRecordRepository } from '../../repositories/ICustomRecordRepository';
import type { ICustomRecordNoteRepository } from '../../repositories/ICustomRecordNoteRepository';
import type { ICustomRecordDocumentRepository } from '../../repositories/ICustomRecordDocumentRepository';

export type DeleteCustomRecordUseCase = {
  execute: (tenantId: string, recordId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteCustomRecordUseCase = (
  repo: ICustomRecordRepository,
  noteRepo: ICustomRecordNoteRepository,
  documentRepo: ICustomRecordDocumentRepository,
): DeleteCustomRecordUseCase => ({
  execute: async (tenantId, recordId, actor) => {
    const [notes, documents] = await Promise.all([
      noteRepo.getNotes(tenantId, recordId),
      documentRepo.getDocuments(tenantId, recordId),
    ]);
    await Promise.all(notes.map((note) => noteRepo.deleteNote(tenantId, recordId, note.id, actor)));
    await Promise.all(documents.map((document) =>
      documentRepo.deleteDocument(tenantId, recordId, document.id, document.storagePath, actor),
    ));
    await repo.delete(tenantId, recordId, actor);
  },
});
