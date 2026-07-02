import type { INewsDocumentRepository } from '../../repositories/INewsDocumentRepository';

export type DeleteNewsDocumentUseCase = { execute: (newsId: string, documentId: string, storagePath: string) => Promise<void> };
export const makeDeleteNewsDocumentUseCase = (repo: INewsDocumentRepository): DeleteNewsDocumentUseCase => ({
  execute: (newsId, documentId, storagePath) => repo.deleteDocument(newsId, documentId, storagePath),
});
