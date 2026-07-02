import type { INewsDocumentRepository } from '../../repositories/INewsDocumentRepository';
import type { NewsDocument } from '../../entities';

export type GetNewsDocumentsUseCase = { execute: (newsId: string) => Promise<NewsDocument[]> };
export const makeGetNewsDocumentsUseCase = (repo: INewsDocumentRepository): GetNewsDocumentsUseCase => ({
  execute: (newsId) => repo.getDocuments(newsId),
});
