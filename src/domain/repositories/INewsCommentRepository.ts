import type { NewsComment, DeletionActor } from '../entities';

export interface INewsCommentRepository {
  getComments(newsId: string): Promise<NewsComment[]>;
  getCommentCountMap(newsIds: string[]): Promise<Record<string, number>>;
  createComment(data: Omit<NewsComment, 'id' | 'likeCount' | 'likedBy'>): Promise<NewsComment>;
  updateComment(id: string, data: { content: string; editedAt: Date; editedByName: string }): Promise<void>;
  deleteComment(id: string, newsId: string, actor: DeletionActor): Promise<void>;
  toggleLike(commentId: string, userId: string, hasLiked: boolean): Promise<void>;
}
