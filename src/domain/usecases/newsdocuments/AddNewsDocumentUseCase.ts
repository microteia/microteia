import type { INewsDocumentRepository } from '../../repositories/INewsDocumentRepository';
import type { NewsDocument } from '../../entities';

export type AddNewsDocumentUseCase = { execute: (newsId: string, data: Omit<NewsDocument, 'id' | 'newsId' | 'createdAt'>) => Promise<NewsDocument> };
export const makeAddNewsDocumentUseCase = (repo: INewsDocumentRepository): AddNewsDocumentUseCase => ({
  execute: (newsId, data) => repo.addDocument(newsId, data),
});
