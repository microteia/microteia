import type { INewsCommentRepository } from '../../repositories/INewsCommentRepository';
import type { NewsComment } from '../../entities';

export type GetNewsCommentsUseCase = {
  execute: (newsId: string) => Promise<NewsComment[]>;
};

export const makeGetNewsCommentsUseCase = (repo: INewsCommentRepository): GetNewsCommentsUseCase => ({
  execute: (newsId) => repo.getComments(newsId),
});
