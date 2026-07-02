import type { INewsDocumentRepository } from '../../repositories/INewsDocumentRepository';

export type UploadNewsDocumentUseCase = { execute: (newsId: string, file: File) => Promise<string> };
export const makeUploadNewsDocumentUseCase = (repo: INewsDocumentRepository): UploadNewsDocumentUseCase => ({
  execute: (newsId, file) => repo.uploadDocument(newsId, file),
});
