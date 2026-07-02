import type { NewsDocument } from '../entities';

export interface INewsDocumentRepository {
  getDocuments(newsId: string): Promise<NewsDocument[]>;
  uploadDocument(newsId: string, file: File): Promise<string>;
  addDocument(newsId: string, data: Omit<NewsDocument, 'id' | 'newsId' | 'createdAt'>): Promise<NewsDocument>;
  deleteDocument(newsId: string, documentId: string, storagePath: string): Promise<void>;
}
