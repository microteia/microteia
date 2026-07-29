import type { DeletionActor } from '../../entities';
import type {
  IRecordDocumentRepository,
  IRecordNoteRepository,
  IRecordRepository,
} from '../../repositories/IRecordRepository';

export type DeleteRecordUseCase = {
  execute: (tenantId: string, collection: string, recordId: string, actor: DeletionActor) => Promise<void>;
};

/** Cascata: anotações e documentos do registro saem antes dele. */
export const makeDeleteRecordUseCase = (
  repo: IRecordRepository,
  noteRepo: IRecordNoteRepository,
  documentRepo: IRecordDocumentRepository,
): DeleteRecordUseCase => ({
  execute: async (tenantId, collection, recordId, actor) => {
    const [notes, documents] = await Promise.all([
      noteRepo.getNotes(tenantId, collection, recordId),
      documentRepo.getDocuments(tenantId, collection, recordId),
    ]);
    await Promise.all(
      notes.map((note) => noteRepo.deleteNote(tenantId, collection, recordId, note.id, actor)),
    );
    await Promise.all(
      documents.map((document) =>
        documentRepo.deleteDocument(tenantId, collection, recordId, document.id, document.storagePath, actor),
      ),
    );
    await repo.delete(tenantId, collection, recordId, actor);
  },
});
