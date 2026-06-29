import type { INewsCommentRepository } from '../../repositories/INewsCommentRepository';
import type { NewsComment } from '../../entities';

export type CreateNewsCommentUseCase = {
  execute: (data: Omit<NewsComment, 'id'>) => Promise<NewsComment>;
};

export const makeCreateNewsCommentUseCase = (repo: INewsCommentRepository): CreateNewsCommentUseCase => ({
  execute: (data) => repo.createComment(data),
});
