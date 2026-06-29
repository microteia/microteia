import type { INewsCommentRepository } from '../../repositories/INewsCommentRepository';

export type UpdateNewsCommentUseCase = {
  execute: (id: string, data: { content: string; editedAt: Date; editedByName: string }) => Promise<void>;
};

export const makeUpdateNewsCommentUseCase = (repo: INewsCommentRepository): UpdateNewsCommentUseCase => ({
  execute: (id, data) => repo.updateComment(id, data),
});
