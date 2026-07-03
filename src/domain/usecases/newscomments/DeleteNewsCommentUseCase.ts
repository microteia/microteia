import type { INewsCommentRepository } from '../../repositories/INewsCommentRepository';
import type { DeletionActor } from '../../entities';

export type DeleteNewsCommentUseCase = {
  execute: (id: string, newsId: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteNewsCommentUseCase = (repo: INewsCommentRepository): DeleteNewsCommentUseCase => ({
  execute: (id, newsId, actor) => repo.deleteComment(id, newsId, actor),
});
