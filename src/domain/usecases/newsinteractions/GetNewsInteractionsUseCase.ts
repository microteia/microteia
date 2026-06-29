import type { INewsInteractionRepository } from '../../repositories/INewsInteractionRepository';
import type { NewsInteraction } from '../../entities';

export type GetNewsInteractionsUseCase = {
  execute: (userId: string) => Promise<NewsInteraction[]>;
};

export const makeGetNewsInteractionsUseCase = (repo: INewsInteractionRepository): GetNewsInteractionsUseCase => ({
  execute: (userId) => repo.getInteractionsForUser(userId),
});
