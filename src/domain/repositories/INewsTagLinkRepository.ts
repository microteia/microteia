import type { NewsTagLink } from '../entities';

export interface INewsTagLinkRepository {
  getLinks(userId: string): Promise<NewsTagLink[]>;
  setTagsForNews(userId: string, newsId: string, tagIds: string[]): Promise<void>;
}
