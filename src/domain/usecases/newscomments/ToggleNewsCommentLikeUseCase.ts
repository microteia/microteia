import type { INewsCommentRepository } from '../../repositories/INewsCommentRepository';

export type ToggleNewsCommentLikeUseCase = {
  execute: (commentId: string, userId: string, hasLiked: boolean) => Promise<void>;
};

export const makeToggleNewsCommentLikeUseCase = (repo: INewsCommentRepository): ToggleNewsCommentLikeUseCase => ({
  execute: (commentId, userId, hasLiked) => repo.toggleLike(commentId, userId, hasLiked),
});
