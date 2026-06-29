import type { INewsCommentRepository } from '../../repositories/INewsCommentRepository';

export type DeleteNewsCommentUseCase = {
  execute: (id: string, newsId: string) => Promise<void>;
};

export const makeDeleteNewsCommentUseCase = (repo: INewsCommentRepository): DeleteNewsCommentUseCase => ({
  execute: (id, newsId) => repo.deleteComment(id, newsId),
});
