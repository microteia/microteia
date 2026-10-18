import { useMemo } from 'react';
import { useDI } from '../../../infrastructure/di/useDI';
import { useNotesPort, type NoteRepositoryLike } from './useNotesPort';
import { useDocumentsPort, type DocumentRepositoryLike } from './useDocumentsPort';
import type { DocumentsPort, NotesPort } from './types';

/**
 * Liga os repositórios genéricos (que recebem a coleção) aos ports das telas de detalhe (que só
 * conhecem o id do registro). É a única diferença de assinatura que sobrou entre as entidades
 * fixas, com repositório próprio por coleção, e as demais.
 */
export const useRecordNotesPort = (collection: string): NotesPort => {
  const { recordNoteRepository } = useDI();
  const bound = useMemo<NoteRepositoryLike>(() => ({
    getNotes: (tenantId, recordId) => recordNoteRepository.getNotes(tenantId, collection, recordId),
    addNote: (tenantId, recordId, data) => recordNoteRepository.addNote(tenantId, collection, recordId, data),
    deleteNote: (tenantId, recordId, noteId, actor) =>
      recordNoteRepository.deleteNote(tenantId, collection, recordId, noteId, actor),
  }), [recordNoteRepository, collection]);
  return useNotesPort(bound);
};

export const useRecordDocumentsPort = (collection: string): DocumentsPort => {
  const { recordDocumentRepository } = useDI();
  const bound = useMemo<DocumentRepositoryLike>(() => ({
    getDocuments: (tenantId, recordId) => recordDocumentRepository.getDocuments(tenantId, collection, recordId),
    uploadDocument: (tenantId, recordId, file) =>
      recordDocumentRepository.uploadDocument(tenantId, collection, recordId, file),
    addDocument: (tenantId, recordId, data) =>
      recordDocumentRepository.addDocument(tenantId, collection, recordId, data),
    deleteDocument: (tenantId, recordId, documentId, storagePath, actor) =>
      recordDocumentRepository.deleteDocument(tenantId, collection, recordId, documentId, storagePath, actor),
    setPortalShared: (tenantId, recordId, documentId, shared, actorUid) =>
      recordDocumentRepository.setPortalShared(tenantId, collection, recordId, documentId, shared, actorUid),
  }), [recordDocumentRepository, collection]);
  return useDocumentsPort(bound);
};
