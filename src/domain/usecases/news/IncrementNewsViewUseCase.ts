import type { INewsRepository } from '../../repositories/INewsRepository';

export type IncrementNewsViewUseCase = {
  execute: (id: string) => Promise<void>;
};

export const makeIncrementNewsViewUseCase = (repo: INewsRepository): IncrementNewsViewUseCase => ({
  execute: (id) => repo.incrementView(id),
});
