import type { INewsRepository } from '../../repositories/INewsRepository';

export type ToggleNewsLikeUseCase = {
  execute: (id: string, userId: string, hasLiked: boolean) => Promise<void>;
};

export const makeToggleNewsLikeUseCase = (repo: INewsRepository): ToggleNewsLikeUseCase => ({
  execute: (id, userId, hasLiked) => repo.toggleLike(id, userId, hasLiked),
});
