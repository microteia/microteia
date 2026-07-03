import type { NewsTag, DeletionActor } from '../entities';

export interface INewsTagRepository {
  getTags(userId: string): Promise<NewsTag[]>;
  createTag(userId: string, data: Omit<NewsTag, 'id' | 'userId' | 'createdAt'>): Promise<NewsTag>;
  updateTag(id: string, data: Partial<Pick<NewsTag, 'name' | 'color'>>): Promise<void>;
  deleteTag(id: string, actor: DeletionActor): Promise<void>;
}
