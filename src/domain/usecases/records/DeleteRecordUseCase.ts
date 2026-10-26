import type { DeletionActor } from '../../entities';
import type {
  IRecordDocumentRepository,
  IRecordNoteRepository,
  IRecordRepository,
} from '../../repositories/IRecordRepository';

export type DeleteRecordUseCase = {
  execute: (tenantId: string, collection: string, recordId: string, actor: DeletionActor) => Promise<void>;
};

/**
 * Cascata: o REGISTRO sai primeiro, e as anotações e os documentos dele depois. Fechada a janela de
 * edição, a regra só deixa apagar o anexo de um registro que já não existe — na ordem inversa, a
 * exclusão permitida do registro esbarraria nos próprios anexos, e as anotações já teriam saído.
 *
 * A recusa da janela vem antes de tudo, e o que falha depois do registro excluído não desfaz a
 * exclusão: é a limpeza de filhos que ninguém mais alcança.
 */
export const makeDeleteRecordUseCase = (
  repo: IRecordRepository,
  noteRepo: IRecordNoteRepository,
  documentRepo: IRecordDocumentRepository,
): DeleteRecordUseCase => ({
  execute: async (tenantId, collection, recordId, actor) => {
    await repo.ensureDeletable(tenantId, collection, recordId);
    const [notes, documents] = await Promise.all([
      noteRepo.getNotes(tenantId, collection, recordId),
      documentRepo.getDocuments(tenantId, collection, recordId),
    ]);
    await repo.delete(tenantId, collection, recordId, actor);
    await Promise.allSettled([
      ...notes.map((note) => noteRepo.deleteNote(tenantId, collection, recordId, note.id, actor)),
      ...documents.map((document) =>
        documentRepo.deleteDocument(tenantId, collection, recordId, document.id, document.storagePath, actor),
      ),
    ]);
  },
});
