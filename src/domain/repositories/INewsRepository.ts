import type { News } from '../entities';

export interface INewsRepository {
  getNews(userId: string, userRole: string, tenantId: string | null): Promise<News[]>;
  getNewsById(id: string): Promise<News | null>;
  createNews(userId: string, data: Omit<News, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<News>;
  updateNews(id: string, data: Partial<Omit<News, 'id' | 'userId' | 'createdAt'>>): Promise<void>;
  deleteNews(id: string): Promise<void>;
  toggleLike(id: string, userId: string, hasLiked: boolean): Promise<void>;
  incrementView(id: string): Promise<void>;
  subscribeToNews(tenantId: string | null, onUpdate: (news: News[]) => void): () => void;
}
